import tkinter as tk
from tkinter import scrolledtext
import json
import random
from nltk.stem import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from Special import OpenAICMD,HTMLStyling




# Initialize stemmer and load stopwords
word_stemmer = PorterStemmer()
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

# Load and parse Discord message data
with open('./DiscServers/ECE 120 Fall 2024 - exams - mt3 [1275789619954323534].json', encoding="utf-8") as discord_messages_file:
    discord_message_data = json.load(discord_messages_file)

import string

import time
# Initialize the spell checker



punctuations=r"""",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“`"""

print(punctuations)

# Function to preprocess message text: removes stopwords, strips punctuation, and applies stemming
def preprocess_message_text(message_text):
    # Remove punctuation, split the message, and filter out stopwords while applying stemming in one pass
    return [
        #word_stemmer.stem(word)
        word
        for word in message_text.translate(str.maketrans('', '', punctuations)).split()
        if word.lower() not in loaded_stopwords or (word.isupper() and len(word)>1) 
    ]

# Group and preprocess messages by author to form conversation blocks
def group_and_preprocess_messages_by_author(message_data):
    conversation_blocks = []  # Will store original blocks
    processed_conversation_blocks = []  # Will store preprocessed blocks
    current_author = None
    author_messages = []

    for message_entry in message_data:
        if "content" in message_entry and "author" in message_entry and "name" in message_entry["author"]:
            author_name = message_entry["author"]["name"]

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




import networkx as nx
import matplotlib.pyplot as plt
import io
from PIL import Image, ImageTk
import tkinter as tk




import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
import io
from PIL import Image, ImageTk

tfidf_dict = {}
with open('./TF-IDF/Study Together - 💭 Community - general [595999872222756888] (after 2024-11-01)_tfidf.json', 'r', encoding='utf-8') as file:
    tfidf_dict = json.load(file)




import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
import io
from PIL import Image, ImageTk
import community as community_louvain

# Function to compute the combined score
def compute_combined_score(tfidf_score, pagerank_score, alpha=0.5, beta=2):
    normalized_tfidf = tfidf_score
    normalized_pagerank = pagerank_score / max(pagerank_score, 1)
    combined_score = alpha * normalized_tfidf + beta * normalized_pagerank
    return combined_score



import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import Normalize
import io
from PIL import Image, ImageTk
import community as community_louvain
import colorsys
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
# Assuming tfidf_dict is defined and compute_combined_score function is implemented



import networkx as nx
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from community import community_louvain

canvas_widget = None
# Function to visualize the NetworkX probability tree and return either node graph or bar graph
def visualize_probability_tree_networkx(probability_tree, option='bar'):
    G = nx.DiGraph()

    global canvas_widget

    # Helper function to add nodes and edges recursively
    def add_nodes_and_edges(parent, sub_tree):
        if isinstance(sub_tree, dict):
            if "probability" in sub_tree:
                G.add_node(parent, probability=sub_tree["probability"])
            for child_word, child_details in sub_tree.items():
                if child_word != "probability":
                    G.add_edge(parent, child_word, label=f"{child_details.get('probability', 'N/A'):.2f}")
                    add_nodes_and_edges(child_word, child_details)

    # Build the graph from the probability tree
    for key, value in probability_tree.items():
        add_nodes_and_edges(key, value)

    G = G.to_undirected()
    

    # Calculate PageRank scores and normalize them
    pagerank_scores = nx.pagerank(G)
    max_pagerank = max(pagerank_scores.values())
    min_pagerank = min(pagerank_scores.values())
    pagerank_range = max_pagerank - min_pagerank if max_pagerank != min_pagerank else 1
    normalized_pagerank_scores = {node: (pagerank_scores[node] - min_pagerank) / pagerank_range for node in pagerank_scores}

    # Sort normalized pagerank scores by value
    sorted_pagerank_scores = dict(sorted(normalized_pagerank_scores.items(), key=lambda item: item[1], reverse=True))

    # Calculate TF-IDF scores and normalize them
    words_in_graph = list(G.nodes)
    tfidf_scores = {word: tfidf_dict.get(word.lower(), 0.0) for word in words_in_graph}
    max_tfidf = max(tfidf_scores.values())
    min_tfidf = min(tfidf_scores.values())
    tfidf_range = max_tfidf - min_tfidf if max_tfidf != min_tfidf else 1
    normalized_tfidf_scores = {word: 1 - ((tfidf_scores[word] - min_tfidf) / tfidf_range) for word in tfidf_scores}

    # Sort normalized TF-IDF scores by value
    sorted_tfidf_scores = dict(sorted(normalized_tfidf_scores.items(), key=lambda item: item[1], reverse=True))

    pagerank_positions = {node: idx if sorted_pagerank_scores[node] != 0.0 else len(sorted_pagerank_scores) - 1 for idx, (node, _) in enumerate(sorted_pagerank_scores.items())}
    tfidf_positions = {
        node: (idx if sorted_tfidf_scores[node] != 1.0 else 0) 
        for idx, (node, _) in enumerate(sorted_tfidf_scores.items())
    }

    print(pagerank_positions)
    print(tfidf_positions)
    # Combine ranks based on PageRank and TF-IDF positions
    combined_rank = {
        node: (pagerank_positions.get(node, 0) + tfidf_positions.get(node, 0)) / 2 
        for node in G.nodes
    }
    
    # Sort combined rank for further use
    sorted_combined_rank = sorted(combined_rank.items(), key=lambda item: item[1])

    # Get partition using Louvain method for community detection
    partition = community_louvain.best_partition(G)

    # Precompute node positions based on combined rank (for 'node' option)
    score_range = max(combined_rank.values()) - min(combined_rank.values()) if combined_rank else 1
    pos = {
        node: (np.random.uniform(0, 2 * np.pi), 1 - (score - min(combined_rank.values())) / score_range)
        for node, score in combined_rank.items()
    }
    
    spring_pos = nx.spring_layout(G, pos=pos, weight='weight', k=0.1, iterations=50)

    # Visualization option: 'node' or 'bar'
    fig, ax = plt.subplots(figsize=(8, 8))
    
    if option == 'node':
        cmap = plt.get_cmap("viridis", max(partition.values()) + 1)
        for community_num in set(partition.values()):
            nodes_in_community = [node for node, comm in partition.items() if comm == community_num]
            nx.draw_networkx_nodes(G, spring_pos, nodelist=nodes_in_community,
                                   node_size=500,
                                   node_color=[cmap(community_num)], ax=ax)
        nx.draw_networkx_edges(G, spring_pos, alpha=0.7, ax=ax)
        nx.draw_networkx_labels(G, spring_pos, font_size=8, font_weight="bold", font_color="black", ax=ax)

    elif option == 'bar':
        words = [word for word, _ in sorted_combined_rank]
        combined_values = [combined_rank[word] for word in words]
        
        bar_width = 0.5
        index = np.arange(len(words))
        
        bars = ax.bar(index, combined_values, bar_width, color='skyblue', label="Combined Score")
        
        ax.set_xlabel('Words')
        ax.set_ylabel('Combined Scores')
        ax.set_title('Words Ranked by Combined Scores')
        ax.set_xticks(index)
        ax.set_xticklabels(words, rotation=60, ha='right')
        ax.legend()

        # Create text annotations for each bar (initially hidden)
        texts = [ax.text(bar.get_x() + bar.get_width() / 2,
                         bar.get_height() + 0.05,
                         word,
                         ha='center',
                         va='bottom',
                         visible=False,
                         fontsize=10) for bar, word in zip(bars, words)]

        # Function to highlight bars on hover and display label
        def on_hover(event):
            for bar in bars:
                bar.set_color('skyblue')
            for text in texts:
                text.set_visible(False)

            for i, bar in enumerate(bars):
                if bar.contains(event)[0]:
                    bar.set_color('orange')
                    texts[i].set_visible(True)
                    break

            fig.canvas.draw_idle()

        fig.canvas.mpl_connect('motion_notify_event', on_hover)

    # Ensure the figure size is consistent across calls
    fig.set_size_inches((10, 8))

    # Update the canvas with the new figure (destroy and repack)
    #canvas_widget = getattr(graph_frame.master.winfo_children()[0], 'canvas', None)
    
    if canvas_widget:
        canvas_widget.get_tk_widget().destroy()

    canvas_widget = FigureCanvasTkAgg(fig, master=graph_frame)
    
    canvas_widget.draw()
    
    canvas_widget.get_tk_widget().pack(fill=tk.BOTH, expand=True)

# Determine background color based on recursion level (depth) for display
def get_color_for_depth_level(depth_level, maximum_depth):
    color_intensity = int(255 * (depth_level / maximum_depth))
    return f"#{255:02x}{color_intensity:02x}{color_intensity:02x}" if depth_level > 1 else "#a6a6a6"

probability_tree={}
# Generate and display a context chain for a random conversation block
def generate_and_display_random_context_chain():
    global probability_tree
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

        construct_context_chain(random_block_words, search_radius, random_block_index, visited_block_indices, context_chain, probability_tree)

        # Pretty print the probability_tree with indentation of 4 spaces
        #print(json.dumps(probability_tree, indent=4))
        context_chain.sort()
        if(len(context_chain)<search_radius//4):
            print("Rerun Random")
            generate_and_display_random_context_chain()
            return

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
        #graph_label.configure(image=graph_image)
        #graph_label.image = graph_image

import tkinter as tk
from tkinter import scrolledtext
from tkinter import messagebox
from tkinterweb import HtmlFrame  # Import HtmlFrame from tkinterweb
from tkinter import ttk
def on_combobox_select(event):
    # Check if combobox is selected
    if combobox.get() == "bar":
        visualize_probability_tree_networkx(probability_tree,"bar")
    else:
        visualize_probability_tree_networkx(probability_tree,"node")

# Initialize Tkinter GUI
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("1200x600")  # Wider window for side-by-side display



combobox = ttk.Combobox(app_main_window, values=["bar", "node"])
combobox.set("bar")
combobox.pack(side=tk.RIGHT, padx=5)

# Bind the combobox selection change event to a function
combobox.bind("<<ComboboxSelected>>", on_combobox_select)

# Create widgets for GUI
tk.Label(app_main_window, text="Enter context chain search radius:").pack(pady=5)
context_radius_input = tk.Entry(app_main_window)
context_radius_input.insert(0, "50")
context_radius_input.pack(pady=5)



tk.Label(app_main_window, text="Generate a context chain from random Discord messages", font=("Arial", 14)).pack(pady=10)
tk.Button(app_main_window, text="Generate Context Chain", command=generate_and_display_random_context_chain, font=("Arial", 12), bg="#4CAF50", fg="white").pack(pady=10)

# Function to handle Summarize button click
def summarize_context_chain():
    # Get all text from the output_text_display (Assuming it's the context chain text)
    context_chain_text = output_text_display.get("1.0", tk.END).strip()

    if not context_chain_text:
        messagebox.showerror("Error", "No context chain to summarize.")
        return

    try:

        # Send the context chain to ChatGPT for summarization
        ChatGPT.send_message("sendGPT","Summarize this combining abstractive and high quality extractive. Don't miss any details in it. Referecne specific messages in your response:"+context_chain_text,learn=True)

    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {e}")

# Summarize Button (Trigger summarize_context_chain function)
tk.Button(app_main_window, text="Summarize", command=summarize_context_chain, font=("Arial", 12), bg="#FF9800", fg="white").pack(pady=10)

# Text display for the context chain
output_text_display = scrolledtext.ScrolledText(app_main_window, wrap=tk.WORD, font=("Arial", 10))
output_text_display.pack(side=tk.LEFT, padx=10, pady=10, expand=True, fill='both')

output_text_display.tag_configure("highlight_selected", background="#DDEEFF", foreground="#003366")
output_text_display.tag_configure("highlight_processed", background="#E0FFE0", foreground="#006600")

# Label for displaying the graph on the right side (assuming graph rendering code is elsewhere)
graph_frame = tk.Frame(app_main_window)
graph_frame.pack(side=tk.RIGHT, padx=10, pady=10, fill='y', expand=False)

# Initialize ChatGPT WebSocket client
ChatGPT = OpenAICMD.WebSocketClientApp("https://ninth-swamp-orangutan.glitch.me")


generator = HTMLStyling.HTMLGenerator()




# Function to handle the response and display it in an HTMLFrame
def handle_summary_response(summary, app_main_window):
    if summary:
        # Generate HTML content for the summary (this can be modified as needed)
        html_result = generator.generate_and_display_html("", summary,theme="ocean")
        print(html_result)

        # Schedule the display of the summary popup to run in the main thread
        app_main_window.after(0, display_summary_popup, html_result, app_main_window)
    else:
        messagebox.showwarning("Warning", "No summary received from ChatGPT.")

def display_summary_popup(html_result, app_main_window):
    # Create a new popup window to display the summary
    summary_popup = tk.Toplevel(app_main_window)
    summary_popup.title("Summary")
    summary_popup.geometry("800x500")
    
    # Create an HTMLFrame widget in the popup for displaying the summary
    summary_display = HtmlFrame(summary_popup, horizontal_scrollbar="auto")

    # Set the HTML content (Summary) to be displayed
    summary_display.load_html(html_result)  # Use the HTML content generated
    summary_display.pack(padx=10, pady=10, fill="both", expand=True)


# Register the callback with lambda function
ChatGPT.register_callback(callback=lambda summary, app_main_window=app_main_window: handle_summary_response(summary, app_main_window))

# Start the Tkinter GUI
app_main_window.mainloop()
