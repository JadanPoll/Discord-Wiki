import tkinter as tk
from tkinter import scrolledtext
import json
import random
from nltk.stem import PorterStemmer
from rapidfuzz import fuzz

#Create Hierachal dictionary
class TreeNode:
    def __init__(self, word, cumulative_probability=1.0):
        self.word = word
        self.children = {}
        self.cumulative_probability = cumulative_probability  # Overall probability for this node

    def add_child(self, word, new_probability):
        if word not in self.children:
            self.children[word] = TreeNode(word, new_probability)
        else:
            # If the word already exists, we update probabilities
            self.update_probabilities(word)

    def update_probabilities(self, word):
        # Redistribute probabilities among all children
        total_children = len(self.children)
        if total_children > 0:
            even_probability = self.cumulative_probability / total_children
            for child_word in self.children:
                self.children[child_word].cumulative_probability = even_probability

    def get_children(self):
        return self.children

    def __repr__(self):
        return f"{self.word} (P = {self.cumulative_probability:.3f})"




def grow_tree_with_probabilities(node, conversation_blocks, max_depth, min_prob_threshold=0.1, depth=0):
    if depth >= max_depth:
        return
    
    current_word = node.word
    # Find all possible words that follow the current word
    possible_words = set(word for block in conversation_blocks for word in block.split())
    
    for word in possible_words:
        probability = calculate_word_transition_probability(current_word, word, conversation_blocks)
        if probability > min_prob_threshold:
            # Add the word as a child with the calculated probability
            node.add_child(word, probability)
            # Recursively grow the tree
            grow_tree_with_probabilities(node.get_children()[word], conversation_blocks, max_depth, min_prob_threshold, depth + 1)


# Function to calculate the conditional probability between two words
def calculate_word_transition_probability(W_c, W_k, conversation_blocks):
    count_Wc = sum(W_c in block for block in conversation_blocks)
    count_Wk_given_Wc = sum(W_c in block and W_k in block for block in conversation_blocks)
    
    # Calculate P(W_k | W_c)
    return count_Wk_given_Wc / count_Wc if count_Wc > 0 else 0


def build_probabilistic_tree(root_word, conversation_blocks, max_depth, min_prob_threshold=0.1):
    root = TreeNode(root_word, probability=1.0)  # Start with root word, with probability 1.0
    grow_tree_with_probabilities(root, conversation_blocks, max_depth, min_prob_threshold)
    return root



def print_tree_with_cumulative_probabilities(node, level=0):
    indent = "  " * level
    print(f"{indent}{node.word} (Cumulative P = {node.cumulative_probability:.3f})")
    
    for child_word, child_node in node.get_children().items():
        print_tree_with_cumulative_probabilities(child_node, level + 1)







# Initialize stemmer and load stopwords
word_stemmer = PorterStemmer()
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

# Load and parse Discord message data
with open('./DiscServers/ECE120_Lab_9_discord_messages.json', encoding="utf-8") as discord_messages_file:
    discord_message_data = json.load(discord_messages_file)

import string
from spellchecker import SpellChecker
import time
# Initialize the spell checker
spell = SpellChecker()




punctuations=r"""",!?.)(:"""


# Function to preprocess message text: removes stopwords, strips punctuation, and applies stemming
def preprocess_message_text(message_text):
    # Remove punctuation, split the message, and filter out stopwords while applying stemming in one pass
    return [
        word_stemmer.stem(word)
        for word in message_text.translate(str.maketrans('', '', punctuations)).split()
        if word.lower() not in loaded_stopwords
    ]

# Group and preprocess messages by author to form conversation blocks
def group_and_preprocess_messages_by_author(message_data):
    conversation_blocks = []  # Will store original blocks
    processed_conversation_blocks = []  # Will store preprocessed blocks
    current_author = None
    author_messages = []

    for message_entry in message_data:
        if "content" in message_entry and "author" in message_entry and "username" in message_entry["author"]:
            author_name = message_entry["author"]["username"]

            # If the author changes, process and save the previous block
            if author_name != current_author:
                if author_messages:
                    # Join the author's messages into one block
                    joined_message_block = " ".join(author_messages)

                    # Store the original conversation block
                    conversation_blocks.append(joined_message_block)

                    # Store the preprocessed conversation block
                    preprocessed_block = " ".join(preprocess_message_text(joined_message_block))
                    processed_conversation_blocks.append(preprocessed_block)

                # Reset for the new author
                current_author = author_name
                author_messages = []

            # Append current message content to the author's block
            author_messages.append(message_entry["content"])

    # Append the last block of messages
    if author_messages:
        joined_message_block = " ".join(author_messages)
        conversation_blocks.append(joined_message_block)

        preprocessed_block = " ".join(preprocess_message_text(joined_message_block))
        processed_conversation_blocks.append(preprocessed_block)

    return conversation_blocks, processed_conversation_blocks

# Load and preprocess conversation blocks in one step
conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)










# Function to search for a query within a message block using word-by-word processing
def find_query_in_message_block(query_list, message_block):
    match_results = {
        "exact_matches": {}  # Dictionary to store matched words for each query word
    }

    # Split the message into words
    message_block_word_list = message_block.split()
    
    # Loop through each query word and search for matches in the message block
    for query_word in query_list:
        # Exact match
        if query_word in message_block_word_list:
            bag_of_words_child_message_if_one_word_in_it_matched_query = [word for word in message_block_word_list if word != query_word]
            if bag_of_words_child_message_if_one_word_in_it_matched_query:
                # Store matches in the dictionary under the query word
                match_results["exact_matches"][query_word] = bag_of_words_child_message_if_one_word_in_it_matched_query

    return match_results["exact_matches"]



# Recursive function to construct context chain with probability updates
def construct_context_chain(inherited_words_bag, search_radius, current_message_index, visited_indices, context_chain, probability_tree, recursion_depth=1):
    # Calculate the range of messages to search within based on the search radius
    start_index = max(0, current_message_index - search_radius)
    end_index = min(len(processed_conversation_blocks), current_message_index + search_radius + 1)

    # Iterate through the conversation blocks within the search range
    for block_index in range(start_index, end_index):
        if block_index not in visited_indices:
            # Find the words that match the query in the current block
            matched_words = find_query_in_message_block(inherited_words_bag, processed_conversation_blocks[block_index])

            if matched_words:
                visited_indices.add(block_index)
                context_chain.append((block_index, conversation_blocks[block_index], recursion_depth))

                # Update the probability tree for each matched word in the block
                for query_word, bag_of_words_around_matched_query_in_child_message_block in matched_words.items():
                    # Update the probability tree with the new matched words
                    probability_tree = update_probability_tree(probability_tree, bag_of_words_around_matched_query_in_child_message_block, query_word)

                    # Expand the list of current words for further recursion (avoiding duplicates)
                    expanded_word_bag = inherited_words_bag + list(set(processed_conversation_blocks[block_index].split()) - set(inherited_words_bag))

                    # Recursively process the next message block with reduced search radius
                    # Pass the updated probability tree correctly here
                    construct_context_chain(expanded_word_bag, max(search_radius // 2, 1), block_index, visited_indices, context_chain, probability_tree[query_word], recursion_depth + 1)

# Function to update the probability tree with matched words and maintain the hierarchical structure
def update_probability_tree(probability_tree, bag_of_words_around_matched_query_in_child_message_block, query_word):

    # If "probability" is used as a key, ensure it won't cause conflicts with actaul float "probability" by renaming
    if query_word == "probability":
        query_word = "base_probability"  # Rename if the query word is "probability" to avoid conflicts

    # If the query word is not in the tree, add it with an initial probability based on the matched words
    if query_word not in probability_tree:
        probability_tree[query_word] = {
            word: 
            {
                "probability": 1 / len(bag_of_words_around_matched_query_in_child_message_block)
            } 
            for word in bag_of_words_around_matched_query_in_child_message_block
        }

        # Calculate the new probability for each key in the probability tree
        num_keys = len(probability_tree)-1 if "probability" in probability_tree else len(probability_tree) # Also we dont want to count probability itself as extra key

        # This will thus override that.
        for key in probability_tree:
            if key != "probability":  # Avoid indexing  the key "probability" which is actually a float not a dict!
                print(key)
                probability_tree[key]["probability"] = 1 / num_keys  # Update the probability

        #print(query_word,num_keys,json.dumps(probability_tree, indent=4))
    else:


        # Store the existing probability for query_word
        temp_probability = probability_tree[query_word]["probability"]
        #print("INteresting set",query_word)
        # Update the query_word entry by keeping the original probability and adding new words
        probability_tree[query_word] = {
            "probability": temp_probability,  # Keep the original probability for query_word
            **{word: {  # Add new words with their probabilities
                "probability": 1 / len(bag_of_words_around_matched_query_in_child_message_block)
            } for word in bag_of_words_around_matched_query_in_child_message_block}
        }
        #print("INtereresting set",query_word,json.dumps(probability_tree, indent=4))
    return probability_tree

import networkx as nx
import matplotlib.pyplot as plt
import random
import json
import networkx as nx
import matplotlib.pyplot as plt
from PIL import Image, ImageTk
import io
import os




# Function to visualize the NetworkX probability tree and return it as a Tkinter-compatible image
def visualize_probability_tree_networkx(probability_tree):
    G = nx.DiGraph()

    # Recursively add nodes and edges from the probability tree
    def add_nodes_and_edges(parent, sub_tree):
        if isinstance(sub_tree, dict):
            if "probability" in sub_tree:
                # Add node for the current word and its probability
                G.add_node(parent, probability=sub_tree["probability"])
            
            # Iterate over the words/children in the sub_tree
            for child_word, child_details in sub_tree.items():
                if child_word != "probability":  # Avoid handling the "probability" key as a child
                    # Add an edge for the parent-child relationship
                    G.add_edge(parent, child_word, label=f"{child_details.get('probability', 'N/A'):.2f}")
                    # Recursively process the child node
                    add_nodes_and_edges(child_word, child_details)

    # Start recursion with the provided tree structure without assuming a root node
    for key, value in probability_tree.items():
        add_nodes_and_edges(key, value)

    # Define layout with parameters to reduce overcrowding
    pos = nx.spring_layout(G, seed=42, k=1.5, iterations=50)  # Increase 'k' for more space, adjust iterations for layout stability
    edge_labels = nx.get_edge_attributes(G, 'label')

    # Plot the graph and save to a Tkinter-compatible image
    plt.figure(figsize=(12, 12))  # Adjust figure size for better visibility
    nx.draw(G, pos, with_labels=True, node_size=3000, node_color='lightblue', font_size=10, font_weight='bold')
    nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels)

    # Save the plot to a buffer
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close()
    
    buf.seek(0)
    img = Image.open(buf)  # Open the image from the buffer

    # Scale down the image by a factor, e.g., 90%
    scale_factor = 0.6
    new_width = int(img.width * scale_factor)
    new_height = int(img.height * scale_factor)
    img = img.resize((new_width, new_height), Image.LANCZOS)

    return ImageTk.PhotoImage(img)  # Return the image as a Tkinter-compatible PhotoImage object


# Determine background color based on recursion level (depth) for display
def get_color_for_depth_level(depth_level, maximum_depth):
    color_intensity = int(255 * (depth_level / maximum_depth))
    return f"#{255:02x}{color_intensity:02x}{color_intensity:02x}" if depth_level > 1 else "#a6a6a6"

# Generate and display a context chain for a random conversation block
def generate_and_display_random_context_chain():
    output_text_display.delete('1.0', tk.END)
    
    try:
        search_radius = int(context_radius_input.get())
    except ValueError:
        output_text_display.insert(tk.END, "Please enter a valid number for context search radius.\n")
        return

    if processed_conversation_blocks:
        random_block_index = random.choice(range(len(processed_conversation_blocks)))
        random_block_words = processed_conversation_blocks[random_block_index].split()
        visited_block_indices = {random_block_index}
        context_chain = [(random_block_index, conversation_blocks[random_block_index], 1)]

        probability_tree={}
        split_cache={}
        os.system("cls")
        construct_context_chain(random_block_words, search_radius, random_block_index, visited_block_indices, context_chain, probability_tree)

        # Pretty print the probability_tree with indentation of 4 spaces
        #print(json.dumps(probability_tree, indent=4))
        context_chain.sort()

        max_recursion_level = max(level for _, _, level in context_chain)

        output_text_display.insert(tk.END, "Selected Message:\n", "highlight_selected")
        output_text_display.insert(tk.END, f"{conversation_blocks[random_block_index]}\n\n", "highlight_selected")

        output_text_display.insert(tk.END, "Processed Version:\n", "highlight_processed")
        output_text_display.insert(tk.END, f"{processed_conversation_blocks[random_block_index]}\n\n", "highlight_processed")

        output_text_display.insert(tk.END, "Context Chain:\n", "highlight_context")
        
        for _, message, level in context_chain:
            depth_tag = f"depth_{level}"
            output_text_display.tag_configure(depth_tag, background=get_color_for_depth_level(level, max_recursion_level))
            output_text_display.insert(tk.END, f"{message}\n{'-'*50}\n", depth_tag)



         # Display the NetworkX graph on the right side of the text output
        graph_image = visualize_probability_tree_networkx(probability_tree)
        graph_label.configure(image=graph_image)
        graph_label.image = graph_image


# Initialize Tkinter GUI
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("1200x600")  # Wider window for side-by-side display

tk.Label(app_main_window, text="Enter context chain search radius:").pack(pady=5)
context_radius_input = tk.Entry(app_main_window)
context_radius_input.insert(0, "10")
context_radius_input.pack(pady=5)

tk.Label(app_main_window, text="Generate a context chain from random Discord messages", font=("Arial", 14)).pack(pady=10)
tk.Button(app_main_window, text="Generate Context Chain", command=generate_and_display_random_context_chain, font=("Arial", 12), bg="#4CAF50", fg="white").pack(pady=10)

# Text display for the context chain
output_text_display = scrolledtext.ScrolledText(app_main_window, wrap=tk.WORD, font=("Arial", 10))
output_text_display.pack(side=tk.LEFT, padx=10, pady=10, expand=True, fill='both')

output_text_display.tag_configure("highlight_selected", background="#DDEEFF", foreground="#003366")
output_text_display.tag_configure("highlight_processed", background="#E0FFE0", foreground="#006600")

# Label for displaying the graph on the right side
graph_label = tk.Label(app_main_window)
graph_label.pack(side=tk.RIGHT, padx=10, pady=10, fill='y', expand=False)

app_main_window.mainloop()