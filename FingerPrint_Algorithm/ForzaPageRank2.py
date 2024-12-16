import time  # Used for measuring cold start
cold_start = time.time()
# Tkinter imports
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from tkinterweb import HtmlFrame  # Import HtmlFrame from tkinterweb
# Special imports
from Special import OpenAICMD, HTMLStyling
# TextRank
from textrank4zh import TextRank4Keyword
import json
# NetworkX and graph utilities
import networkx as nx
import community as community_louvain  # For graph partitioning
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
# NumPy for numerical operations
import numpy as np
# Tkinter integration with matplotlib

import random
from kneed import KneeLocator
from GroupTheoryAPI import *

import threading
print(f"Cold Start 0: {time.time()-cold_start}")


# Initialize the spell checker

cold_start = time.time()

text_rank = TextRank4Keyword()  # Initialize TextRank globally
text_rank.analyze("Removing cold start", window=2, lower=True) #Here to reduce cold start
print(f"Cold Start 1: {time.time()-cold_start}")

def extract_topics0(passage, num_text_rank_keywords=7):
    """
    Extract keywords/topics from a text using TextRank and preprocessing.
    
    Args:
        passage (str): The input text to analyze.
        num_text_rank_keywords (int): Number of TextRank keywords to return.

    Returns:
        set: Combined set of extracted terms.
    """

    # Preprocess the passage
    processed_passage = " ".join(preprocess_message_text(passage))  # Joins processed tokens into text
    
    # Use TextRank to extract keywords

    text_rank.analyze(processed_passage, window=2, lower=True)
    print(text_rank.get_keywords(num_text_rank_keywords, word_min_len=3))

    text_rank_terms = set(
        keyword.word for keyword in text_rank.get_keywords(num_text_rank_keywords, word_min_len=3)
    )
    
    return text_rank_terms



# Global variable to store canvas widget
canvas_widget = None

def submit_graph(fig):
    """Submit the plot figure to the Tkinter canvas in a separate thread."""
    # Run the plotting code in a separate thread
    #thread = threading.Thread(target=render_graph, args=(fig,))
    #thread.start()
    render_graph(fig)


from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure


def render_graph(fig: Figure):
    """Render the graph on the Tkinter canvas."""
    global canvas_widget
    
    def update_canvas():
        global canvas_widget
        """Update the canvas widget on the main thread."""
        # If there's an existing canvas widget, update the figure if needed
        if canvas_widget:
            # Preserve the current canvas size
            canvas_size = canvas_widget.get_tk_widget().winfo_width(), canvas_widget.get_tk_widget().winfo_height()

            # Update the figure in the existing canvas widget
            canvas_widget.figure = fig
            
            # Set the figure size to match the canvas size
            fig.set_size_inches(canvas_size[0] / fig.dpi, canvas_size[1] / fig.dpi)
            
            canvas_widget.draw()  # Redraw the canvas to reflect the updated figure
        
        else:
            # Create a new canvas widget to display the plot if it doesn't exist yet
            canvas_widget = FigureCanvasTkAgg(fig, master=graph_frame)
            canvas_widget.get_tk_widget().pack(fill=tk.BOTH, expand=True)
            
            # Set the figure size to match the canvas size when creating it
            canvas_size = canvas_widget.get_tk_widget().winfo_width(), canvas_widget.get_tk_widget().winfo_height()
            fig.set_size_inches(canvas_size[0] / fig.dpi, canvas_size[1] / fig.dpi)
            
            canvas_widget.draw()  # Initial draw to render the plot

    # Use the `after` method to schedule the `update_canvas` function to run in the main thread
    graph_frame.after(0, update_canvas)



def visualize_elbow_and_knee(scores, cutoff):
    """
    Visualize the scores against ranks and highlight the elbow/knee point.
    
    Args:
        scores (list): List of keyword scores.
        cutoff (int): The cutoff point for the knee/elbow.
        graph_frame (tk.Frame): Tkinter frame to display the graph.
    """

    # Check if the graph_frame is currently visible (packed)
    if not graph_frame.winfo_ismapped():
        print("Graph frame is not currently visible. Skipping visualization.")
        return None  # Return early if the frame is not visible

    x = range(1, len(scores) + 1)  # X-axis (rank of keywords)
    
    # Plot the scores and mark the knee/elbow point
    plt.figure(figsize=(8, 6))
    plt.plot(x, scores, label="Keyword Scores", color='b', marker='o')
    plt.axvline(x=cutoff, color='r', linestyle='--', label=f"Cutoff (Knee) at {cutoff}")
    plt.xlabel('Keyword Rank')
    plt.ylabel('Keyword Score')
    plt.title('Keyword Scores vs Rank (with Knee/Elbow Detection)')
    plt.legend()

    # Get the current figure
    fig = plt.gcf()

    # Use submit_graph to render the figure in the Tkinter canvas
    submit_graph( fig)

    return cutoff


def extract_topics(text):
    """
    Extract keywords from the text and visualize the elbow/knee for keyword selection.
    
    Args:
        text (str): The input text to analyze.
        
    Returns:
        list: List of optimal keywords based on TextRank.
    """
    # Analyze the text with TextRank
    text_rank.analyze(text, window=2, lower=True)
    keywords = text_rank.get_keywords(100, word_min_len=3)

    # Sort keywords by scores in descending order
    scores = [kw.weight for kw in keywords]

    if not scores:  # Handle cases where no keywords are found
        return []
    x = range(1, len(scores) + 1)  # X-axis (rank of keywords)
    knee_locator = KneeLocator(x, scores, curve="convex", direction="decreasing")
    cutoff = knee_locator.knee or len(scores)  # Default to all if no knee is found

    # Visualize elbow/knee and get the cutoff point
    visualize_elbow_and_knee(scores,cutoff)
    
    # Select keywords up to the cutoff point
    optimal_keywords = [kw.word for kw in keywords[:cutoff]]
    return optimal_keywords


cold_start = time.time()

with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

# Load and parse Discord message data
with open('./DiscServers/CEMU_discord_messages.json', encoding="utf-8") as discord_messages_file:
    discord_message_data = json.load(discord_messages_file)

tfidf_dict = {}
with open('./TF-IDF/Study Together - 💭 Community - general [595999872222756888] (after 2024-11-01)_tfidf.json', 'r', encoding='utf-8') as file:
    tfidf_dict = json.load(file)



print(f"Cold Start 2: {time.time()-cold_start}")

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

        elif "content" in message_entry and "author" in message_entry and "username" in message_entry["author"]:
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



cold_start = time.time()
# Load and preprocess conversation blocks in one step
conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)


print(f"Cold Start 3: {time.time()-cold_start}")










# Function to search for a query within a message block using word-by-word processing
def find_query_in_message_block(query_list, message_block):
    match_results = {"exact_matches": {}}
    message_block_word_set = set(message_block.split())
    
    for query_word in query_list:
        if query_word in message_block_word_set:
            bag_of_words = [word for word in message_block_word_set if word != query_word]
            if bag_of_words:
                match_results["exact_matches"][query_word] = bag_of_words
    
    return match_results["exact_matches"]

# Recursive function to construct context chain with probability updates
def construct_context_chain(inherited_words_bag, search_radius, current_message_index, visited_indices, context_chain, recursion_depth=1):
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

                    # Expand the list of current words for further recursion (avoiding duplicates)
                    expanded_word_bag = inherited_words_bag + list(set(processed_conversation_blocks[block_index].split()) - set(inherited_words_bag))

                    # Recursively process the next message block with reduced search radius
                    # Pass the updated probability tree correctly here
                    construct_context_chain(expanded_word_bag, max(search_radius // 2, 1), block_index, visited_indices, context_chain,  recursion_depth + 1)








# Function to compute the combined score
def compute_combined_score(tfidf_score, pagerank_score, alpha=0.5, beta=2):
    normalized_tfidf = tfidf_score
    normalized_pagerank = pagerank_score / max(pagerank_score, 1)
    combined_score = alpha * normalized_tfidf + beta * normalized_pagerank
    return combined_score




# Function to visualize the NetworkX probability tree and return either node graph or bar graph
def visualize_probability_tree_networkx(probability_tree):
    option = combobox.get()
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



found_id = set()  # Tracks all processed conversation IDs

def generate_and_display_all_random_context_chain():
    """
    Autonomously finds and generates context chains for all conversations.
    Ensures no duplicate processing for conversations already found.
    """
    cold_start = time.time()
    global found_id
    print(len(processed_conversation_blocks))
    for index in range(len(processed_conversation_blocks)):

        if index not in found_id:
            generate_and_display_random_context_chain2(index)




    print(f"Cold Start 5: {time.time()-cold_start}")


# Generate and display a context chain for a random conversation block
def generate_and_display_random_context_chain2(index):
    """
    Generates and displays a context chain for a specific or random conversation block.
    If `index` is provided, it processes that specific conversation block; otherwise, 
    it picks a random block to process.
    """
    global found_id
    global probability_tree

    try:
        search_radius = int(context_radius_input.get())
    except ValueError:
        output_text_display.insert(tk.END, "Please enter a valid number for context search radius.\n")
        return

    if processed_conversation_blocks:
        # Select block by index or randomly
        random_block_index = index if index is not None else random.choice(range(len(processed_conversation_blocks)))
        random_block_words = processed_conversation_blocks[random_block_index].split()
        visited_block_indices = {random_block_index}
        context_chain = [(random_block_index, conversation_blocks[random_block_index], 1)]

        probability_tree = {}


        # Construct context chain
        construct_context_chain(random_block_words, search_radius, random_block_index, visited_block_indices, context_chain)


        if len(context_chain) < search_radius // 4 and index is not None:

            return

        context_chain.sort()


        # Add topic and descriptions to the tree
        topic_id = topic_tree.add_topic(conversation_blocks[random_block_index])
        for block_id, message, level in context_chain:
            found_id.add(block_id)

            topic_tree.add_description(topic_id, message, {"message_id": block_id,"level":level})


# Generate and display a context chain for a random conversation block
def generate_and_display_random_context_chain(index=None):
    """
    Generates and displays a context chain for a specific or random conversation block.
    If `index` is provided, it processes that specific conversation block; otherwise, 
    it picks a random block to process.
    """
    global found_id
    save = True
    if index is not None:
        save = True
    global probability_tree
    output_text_display.delete('1.0', tk.END)
    
    try:
        search_radius = int(context_radius_input.get())
    except ValueError:
        output_text_display.insert(tk.END, "Please enter a valid number for context search radius.\n")
        return

    if processed_conversation_blocks:
        # Select block by index or randomly
        random_block_index = index if index is not None else random.choice(range(len(processed_conversation_blocks)))
        random_block_words = processed_conversation_blocks[random_block_index].split()
        visited_block_indices = {random_block_index}
        context_chain = [(random_block_index, conversation_blocks[random_block_index], 1)]

        probability_tree = {}
        split_cache = {}

        # Construct context chain
        construct_context_chain(random_block_words, search_radius, random_block_index, visited_block_indices, context_chain)

        context_chain.sort()

        # If the chain is too short and index was random, rerun with a new block
        if len(context_chain) < search_radius // 4 and index is None:
            print("Rerun Random")
            generate_and_display_random_context_chain()
            return
        elif len(context_chain) < search_radius // 4 and index is not None:

            return

        max_recursion_level = max(level for _, _, level in context_chain)

        # Display selected message
        output_text_display.insert(tk.END, "Selected Message:\n", "highlight_selected")
        output_text_display.insert(tk.END, f"{conversation_blocks[random_block_index]}\n\n", "highlight_selected")

        output_text_display.insert(tk.END, "Processed Version:\n", "highlight_processed")
        output_text_display.insert(tk.END, f"{processed_conversation_blocks[random_block_index]}\n\n", "highlight_processed")

        output_text_display.insert(tk.END, "Context Chain:\n", "highlight_context")

        if save:
            # Add topic and descriptions to the tree
            topic_id = topic_tree.add_topic(conversation_blocks[random_block_index])
            for id, message, level in context_chain:
                topic_tree.add_description(topic_id, message, {"message_id": id,"level":level})

        for block_id, message, level in context_chain:
            # Add to the processed set
            found_id.add(block_id)

            depth_tag = f"depth_{level}"
            output_text_display.tag_configure(depth_tag, background=get_color_for_depth_level(level, max_recursion_level))
            output_text_display.insert(tk.END, f"{message}\n{'-'*50}\n", depth_tag)

        # Display the NetworkX graph on the right side of the text output
        #graph_image = visualize_probability_tree_networkx(probability_tree)
        # graph_label.configure(image=graph_image)
        # graph_label.image = graph_image






def display_selected_glossary(item,conversation_number):
    """
    Displays the selected glossary item and its associated conversation blocks.
    
    :param item: The selected glossary item (topic or ID) to be displayed.
    """
    output_text_display.delete('1.0', tk.END)  # Clear the text display
    

    topic_name = item  # If the item is an ID, you might need to map it to the glossary data
    
    # Display parent node's topic
    output_text_display.insert(tk.END, f"Topic: {topic_name}\n")
    output_text_display.insert(tk.END, "-" * 50 + "\n")
    
    # Display associated conversation blocks for this topic
    if topic_name in glossary:
        print(topic_name, conversation_number)
        convo_block = glossary.get(topic_name,"")[conversation_number]
        for message_id in convo_block:
            # Fetch the message from the conversation block using message_id
            message = conversation_blocks[message_id]
            
            # Display the message with separator
            output_text_display.insert(tk.END, f"{message}\n{'-' * 50}\n")




def process_topic_node(item_id):
    """Callback to process and display values of the selected topic node and its children."""
    output_text_display.delete('1.0', tk.END)  # Clear the text display

    # Retrieve the topic name for the selected parent item
    topic = topic_tree.tree.item(item_id, "text")  # Topic name (column #0)

    # Display parent node's topic
    output_text_display.insert(tk.END, f"Topic: {topic}\n")
    output_text_display.insert(tk.END, "-"*50 + "\n")

    # Get child IDs of the parent node (item_id)
    child_ids = topic_tree.tree.get_children(item_id)  # Correct method to get children

    # Initialize max_recursion_level to find the maximum level
    max_recursion_level = 1  # Default level

    # Iterate through children and calculate max_recursion_level
    for child_id in child_ids:
        # Retrieve the HiddenInfo and parse it
        child_hidden_info = topic_tree.tree.set(child_id, "HiddenInfo")  # HiddenInfo (stringified dict)
        try:
            child_hidden_info = json.loads(child_hidden_info) if child_hidden_info else {}
            max_recursion_level = max(max_recursion_level, child_hidden_info.get('level', 1))
        except json.JSONDecodeError:
            continue  # If JSON parsing fails, skip this child node

    # Now we only have max_recursion_level calculated, no need to insert it
    # Second pass: Process the children and display their details
    total=""
    if child_ids:
        for child_id in child_ids:
            # Retrieve child description and hidden info
            child_description = topic_tree.tree.set(child_id, "Description")  # Child description
            child_hidden_info = topic_tree.tree.set(child_id, "HiddenInfo")  # HiddenInfo (stringified dict)

            # Parse the HiddenInfo JSON
            try:
                child_hidden_info = json.loads(child_hidden_info) if child_hidden_info else {}
            except json.JSONDecodeError:
                child_hidden_info = {}

            # Create a context_chain for this child (assuming this data structure)
            full_message = [(child_hidden_info.get('message_id', ''), child_description, child_hidden_info.get('level', 1))]

            # Display each message using custom format
            for id, message, level in full_message:
                total+=processed_conversation_blocks[id]+'\n'
                # Define depth_tag and configure the tag for display
                depth_tag = f"depth_{level}"
                output_text_display.tag_configure(depth_tag, background=get_color_for_depth_level(level, max_recursion_level))  # Set color based on depth


                output_text_display.insert(tk.END, f"{message}\n{'-'*50}\n", depth_tag)


    else:
        output_text_display.insert(tk.END, "\nNo children available.\n")


    description = extract_topics(total)
    print(description)
    topic_tree.add_topic_description(item_id,f"    \t  {' , '.join([word for word in description])}  ")
    output_text_display.after(0,lambda :(update_glossary(), update_clustering(tree,float(0.0),glossary)) )

class TopicTreeview:
    def __init__(self, parent):
        # Create Treeview widget
        self.tree = ttk.Treeview(parent, height=5)
        self.tree.pack(fill=tk.BOTH, expand=False)

        # Define columns
        columns = ("Description", "HiddenInfo")
        self.tree["columns"] = columns

        # Format columns
        self.tree.column("#0", width=200, anchor=tk.W)  # Column for main topics
        for col in columns:
            self.tree.column(col, width=400, anchor=tk.W)

        # Add column headings
        self.tree.heading("#0", text="Topics")
        for col in columns:
            self.tree.heading(col, text=col)

        # Initialize callback lists
        self.select_callbacks_key = []
        self.select_callbacks_value = []
        self.click_callbacks_key = []
        self.click_callbacks_value = []
        self.double_click_callbacks_key = []
        self.double_click_callbacks_value = []

        # Bind events
        #self.tree.bind("<Up>", self._on_select)
        #self.tree.bind("<Down>", self._on_select)
        self.tree.bind("<<TreeviewSelect>>",self._on_select)

        self.tree.bind("<Button-1>", self._on_click)
        self.tree.bind("<Double-1>", self._on_double_click)

        self.style = ttk.Style()
        self.style.configure("Treeview", rowheight=30)

    def add_topic(self, topic,description=None):
        """Add a new topic to the Treeview."""
        topic = self._wrap_text(topic, 50)  # Wrap text if too long
        topic_id = self.tree.insert("", "end", text=topic)
        if description is None:
            self.tree.set(topic_id, "Description", "...")
        else:
            self.tree.set(topic_id, "Description", description)
        #self.tree.insert()
        return topic_id

    def add_topic_description(self, topic_id,description):
            self.tree.set(topic_id, "Description", description)

    def add_description(self, topic_id, description, hidden_info=None):
        """Add a description under a specific topic with optional hidden info."""
        description = self._wrap_text(description, 90)  # Wrap text if too long
        item_id = self.tree.insert(topic_id, "end", text="", values=(description,))

        # Store hidden info as a tag or attribute
        if hidden_info is not None:
            self.tree.set(item_id, "HiddenInfo", json.dumps(hidden_info))  # Convert dict to string if needed

    def _wrap_text(self, text, line_length):
        """Wrap text to a specified line length for display."""
        words = text.split()
        lines = []
        current_line = []

        for word in words:
            if sum(len(w) for w in current_line) + len(current_line) + len(word) > line_length:
                lines.append(" ".join(current_line))
                current_line = []
            current_line.append(word)

        if current_line:
            lines.append(" ".join(current_line))

        return "\n".join(lines)




    def _on_select(self, event):
        print("OnSelect",event)
        """Handle selection events and determine if the item is a key or a child of a key."""
        selected_items = self.tree.selection()  # Get all selected items

        for item_id in selected_items:
            parent_id = self.tree.parent(item_id)  # Get the parent of the item

            if parent_id == "":  # Root-level item
                # Handle as a key
                for callback in self.select_callbacks_key:
                    callback(item_id)
            else:
                # Handle as a child of a key
                hidden_info = self.tree.set(item_id, "HiddenInfo")
                if hidden_info:
                    for callback in self.select_callbacks_value:
                        callback(json.loads(hidden_info))


    def _on_click(self, event):
        """Handle single-click events."""
        print("OnClick",event)
        region = self.tree.identify_region(event.x, event.y)
        item_id = self.tree.identify_row(event.y)

        if item_id:  # Ensure an item is clicked
            if region == "tree":
                for callback in self.click_callbacks_key:
                    callback(item_id)
            elif region == "cell":
                hidden_info = self.tree.set(item_id, "HiddenInfo")  # Retrieve hidden info
                if hidden_info:
                    for callback in self.click_callbacks_value:
                        callback(json.loads(hidden_info))

    def _on_double_click(self, event):
        """Handle double-click events."""
        region = self.tree.identify_region(event.x, event.y)
        item_id = self.tree.identify_row(event.y)

        if item_id:  # Ensure an item is double-clicked
            if region == "tree":
                for callback in self.double_click_callbacks_key:
                    callback(item_id)
            elif region == "cell":
                hidden_info = self.tree.set(item_id, "HiddenInfo")  # Retrieve hidden info
                if hidden_info:
                    for callback in self.double_click_callbacks_value:
                        callback(json.loads(hidden_info))

    def add_select_callback_key(self, callback):
        """Add a callback for single-click events on keys."""
        self.select_callbacks_key.append(callback)
    
    def add_select_callback_value(self, callback):
        """Add a callback for select events on values."""
        self.select_callbacks_value.append(callback)
    
    def add_click_callback_key(self, callback):
        """Add a callback for single-click events on keys."""
        self.click_callbacks_key.append(callback)

    def add_click_callback_value(self, callback):
        """Add a callback for single-click events on values."""
        self.click_callbacks_value.append(callback)

    def add_double_click_callback_key(self, callback):
        """Add a callback for double-click events on keys."""
        self.double_click_callbacks_key.append(callback)

    def add_double_click_callback_value(self, callback):
        """Add a callback for double-click events on values."""
        self.double_click_callbacks_value.append(callback)







# Function to handle combobox selection
def on_combobox_select(event):
    if combobox.get() == "bar":
        visualize_probability_tree_networkx(probability_tree)
    else:
        visualize_probability_tree_networkx(probability_tree)

# Function to handle the Generate Context Chain command
def generate_context_chain():
    try:
        generate_and_display_all_random_context_chain()
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred while generating context chain: {e}")

# Function to handle Summarize button click
def summarize_context_chain():
    context_chain_text = output_text_display.get("1.0", tk.END).strip()
    if not context_chain_text:
        messagebox.showerror("Error", "No context chain to summarize.")
        return

    try:
        ChatGPT.send_message(
            "sendGPT",
            "Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response. If possible break it into subheadings:" + context_chain_text,
            learn=True
        )
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {e}")

# Function to display the summary in a popup window
def display_summary_popup(html_result, app_main_window):
    summary_popup = tk.Toplevel(app_main_window)
    summary_popup.title("Summary")
    summary_popup.geometry("800x500")
    
    summary_display = HtmlFrame(summary_popup, horizontal_scrollbar="auto")
    summary_display.load_html(html_result)
    summary_display.pack(padx=10, pady=10, fill="both", expand=True)

# Callback to handle the response from ChatGPT
def handle_summary_response(summary, app_main_window):
    if summary:
        html_result = generator.generate_and_display_html("", summary, theme="ocean")
        app_main_window.after(0, display_summary_popup, html_result, app_main_window)
    else:
        messagebox.showwarning("Warning", "No summary received from ChatGPT.")


cold_start = time.time()
# Initialize Tkinter GUI
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("1200x600")


glossary = {}
def update_glossary():
    global glossary

    # Loop through all items in the Treeview
    for item_id in topic_tree.tree.get_children():
        description = topic_tree.tree.set(item_id, "Description")  # Get description of the topic
        if description:
            # Split the description by commas and strip each keyword
            keywords = [kw.strip() for kw in description.split(',') if kw.strip()!="..."]

            numerical_ids = []
            # Loop through each child of the current item
            for child_id in topic_tree.tree.get_children(item_id):
                # Extract the HiddenInfo column (numerical ID)
                hidden_info = topic_tree.tree.set(child_id, "HiddenInfo")
                if hidden_info:
                    try:
                        hidden_info_data = json.loads(hidden_info)  # Assuming it's in JSON format
                        numerical_id = hidden_info_data['message_id']  # Directly assuming it's the numerical ID
                        numerical_ids.append(numerical_id)
                    except json.JSONDecodeError:
                        continue  # In case there is an issue with the HiddenInfo data

                    # Add the numerical ID to the keywords in the glossary
            for keyword in keywords:
                if keyword not in glossary:
                    glossary[keyword] = []
                glossary[keyword].append(numerical_ids)

def generate_glossary():
    global glossary
    # Save the glossary to a file
    with open('glossary.json', 'w') as f:
        json.dump(glossary, f, indent=4)

    print("Glossary generated and saved to glossary.json")



def show_glossary():
    hide_all_frames()
    print("Showing Glossary")
    glossary_frame.pack(side=tk.RIGHT, padx=10, pady=10, fill='y', expand=False)

def show_graphs():
    hide_all_frames()
    print("Showing Graphs")
    graph_frame.pack()


# Function to hide all frames (to be called before showing a new one)
def hide_all_frames():
    # Hide graph frame if it's packed
    if 'graph_frame' in globals() and graph_frame.winfo_ismapped():
        graph_frame.pack_forget()
    
    # Hide glossary frame if it's packed
    if 'glossary_frame' in globals() and glossary_frame.winfo_ismapped():
        glossary_frame.pack_forget()



# Initialize Menu bar
menu_bar = tk.Menu(app_main_window)

# Create 'Generate' menu
generate_menu = tk.Menu(menu_bar, tearoff=0)
generate_menu.add_command(label="Generate Context Chain", command=generate_context_chain)
generate_menu.add_command(label="Generate Glossary", command=generate_glossary)

# Create 'Summarize' menu
summarize_menu = tk.Menu(menu_bar, tearoff=0)
summarize_menu.add_command(label="Summarize", command=summarize_context_chain)

# Create 'File' menu (for exiting)
file_menu = tk.Menu(menu_bar, tearoff=0)
file_menu.add_separator()
file_menu.add_command(label="Exit", command=app_main_window.quit)

# Create 'Tools' menu with cascading options (Show Glossary, Show Graphs)
tools_menu = tk.Menu(menu_bar, tearoff=0)
tools_menu.add_radiobutton(label="Show Glossary",value="Show Glossary", command=show_glossary)
tools_menu.add_radiobutton(label="Show Graphs", command=show_graphs)

# Add menus to the menu bar
menu_bar.add_cascade(label="File", menu=file_menu)
menu_bar.add_cascade(label="Generate", menu=generate_menu)
menu_bar.add_cascade(label="Summarize", menu=summarize_menu)
menu_bar.add_cascade(label="Tools", menu=tools_menu)

# Configure the menu bar for the main window
app_main_window.config(menu=menu_bar)

# Topic Treeview setup (assuming TopicTreeview is defined elsewhere)
topic_tree = TopicTreeview(app_main_window)
topic_id = topic_tree.add_topic("Microbits as topic")
descriptions = [
    "Microbits are small programmable devices.",
    "They are used in education for coding projects.",
    "Microbits support various programming languages like Python and JavaScript.",
    "They have built-in sensors for temperature and motion.",
    "Microbits can communicate wirelessly with each other."
]
for description in descriptions:
    topic_tree.add_description(topic_id, description)

topic_tree.add_double_click_callback_value(lambda metadata: (print(metadata), generate_and_display_random_context_chain(metadata['message_id'])))
topic_tree.add_select_callback_key(process_topic_node)

# Input for context chain search radius
tk.Label(app_main_window, text="Enter context chain search radius:").pack(pady=5)
context_radius_input = tk.Entry(app_main_window)
context_radius_input.insert(0, "50")
context_radius_input.pack(pady=5)

# Output text display (ScrolledText widget)
output_text_display = scrolledtext.ScrolledText(app_main_window, wrap=tk.WORD, font=("Arial", 10))
output_text_display.pack(side=tk.LEFT, padx=10, pady=10, expand=True, fill='both')

output_text_display.tag_configure("highlight_selected", background="#DDEEFF", foreground="#003366")
output_text_display.tag_configure("highlight_processed", background="#E0FFE0", foreground="#006600")





# Graph frame (placeholder for graph visualization)
graph_frame = tk.Frame(app_main_window)
graph_frame.pack(side=tk.RIGHT, padx=10, pady=10, fill='y', expand=True)
graph_frame.pack_forget()



# Create a frame to contain the widgets
glossary_frame = tk.Frame(app_main_window)
glossary_frame.pack(side=tk.RIGHT, padx=10, pady=10, fill='y', expand=False)


def on_glossary_treeview_select(event):
    """
    Callback function that gets triggered when an item in the Treeview is selected.
    
    :param event: The event triggered by the selection.
    """
    selected_item = tree.selection()  # Get the selected item (ID or name)
    if selected_item:
        item_name = tree.item(selected_item[0])['text']  # Get the text (name) of the selected item
        gl_len=len(glossary[item_name])-1
        update_glossary_upper_limit(gl_len)

        display_selected_glossary(item_name,int(spinbox.get()))  # Call the function with the selected item name

# Create a Treeview widget
tree = ttk.Treeview(glossary_frame)
tree.heading("#0", text="Group Hierarchy", anchor="w")

# Bind the selection event to call the display_selected_glossary function
tree.bind("<<TreeviewSelect>>", on_glossary_treeview_select)

tree.pack(fill="both", expand=True)


def update_glossary_upper_limit(limit_num):
    spinbox.config(to=limit_num)  # Dynamically set the upper limit


# Create a Spinbox widget for selecting numbers
spinbox = tk.Spinbox(glossary_frame, from_=0, to=1, increment=1, width=5)
spinbox.pack(fill="x")

# Create a slider widget
slider = tk.Scale(glossary_frame, from_=0.0, to=1.0, orient='horizontal', resolution=0.01,
                label="Clustering Sensitivity", command=lambda val,tree=tree: update_clustering(tree,float(val)))
#Call the update
update_clustering(tree,float(0.0))
slider.pack(fill="x")



# Initialize ChatGPT WebSocket client and register callback
ChatGPT = OpenAICMD.WebSocketClientApp("https://ninth-swamp-orangutan.glitch.me")
ChatGPT.register_callback(callback=lambda summary: handle_summary_response(summary, app_main_window))

generator = HTMLStyling.HTMLGenerator()


print(f"Cold Start 4: {time.time()-cold_start}")


# Start the Tkinter GUI loop
app_main_window.mainloop()
