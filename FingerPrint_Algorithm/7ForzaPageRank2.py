import time
import os

import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from tkinterweb import HtmlFrame
from Special import OpenAICMD, HTMLStyling
from textrank4zh import TextRank4Keyword
import json
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from kneed import KneeLocator
from GroupTheoryAPI2 import *
import threading
from tkinter import filedialog
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import spacy

import objgraph


text_rank = TextRank4Keyword(


)  # Initialize TextRank globally
text_rank.analyze("Removing cold start", window=5, lower=True) #Here to reduce cold start

# Global variable to store canvas widget
canvas_widget = None

def submit_graph(fig):
    """Submit the plot figure to the Tkinter canvas in a separate thread."""
    # Run the plotting code in a separate thread
    #thread = threading.Thread(target=render_graph, args=(fig,))
    #thread.start()
    render_graph(fig)




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



# Load the spaCy model for English
nlp = spacy.load("en_core_web_sm")

def filter_words_by_pos(words, pos_tags):
    """
    Filters words from an array based on the given list of POS tags.
    
    :param words: A list of words (strings).
    :param pos_tags: A list of POS tags to keep (e.g., ['NOUN', 'VERB']).
    :return: A list of words that match the specified POS tags.
    """
    # Join the words into a single string to process them with spaCy
    text = ' '.join(words)

    # Process the text using spaCy
    doc = nlp(text)

    # Filter words based on the specified POS tags
    filtered_words = [token.text for token in doc if token.pos_ in pos_tags]

    return filtered_words

def extract_topics(text,visualize=False):
    """
    Extract keywords from the text and visualize the elbow/knee for keyword selection.
    
    Args:
        text (str): The input text to analyze.
        
    Returns:
        list: List of optimal keywords based on TextRank.
    """
    # Analyze the text with TextRank
    text_rank.analyze(text, window=5, lower=True)
    keywords = text_rank.get_keywords(100, word_min_len=3)

    # Sort keywords by scores in descending order
    scores = [kw.weight for kw in keywords]

    if not scores:  # Handle cases where no keywords are found
        return []
    x = range(1, len(scores) + 1)  # X-axis (rank of keywords)
    knee_locator = KneeLocator(x, scores, curve="convex", direction="decreasing")
    cutoff = knee_locator.knee or len(scores)  # Default to all if no knee is found

    if visualize:
        # Visualize elbow/knee and get the cutoff point
        visualize_elbow_and_knee(scores,cutoff)

    # Select keywords up to the cutoff point
    optimal_keywords = [kw.word for kw in keywords[:cutoff]]

    pos_to_keep = ['NOUN','PROPN']# 'VERB']

    filtered_words = filter_words_by_pos(optimal_keywords, pos_to_keep)

    return filtered_words



FILEPATH='./DiscServers/ECE 120 Fall 2024 - Labs - lab10 [1275789619480498319].json'
GLOSSARY_FILEPATH = f"GLOSSARY/GLOSSARY_{os.path.basename(FILEPATH)}"
SUMMARIES_FILEPATH = f"SUMMARY/SUMMARY_{os.path.basename(FILEPATH)}"
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))
# Load and parse Discord message data
with open(FILEPATH, encoding="utf-8") as discord_messages_file:
    discord_message_data = json.load(discord_messages_file)
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


    conversation_blocks, processed_conversation_blocks



# Load and preprocess conversation blocks in one step
conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)

def load_conversation():
    global conversation_blocks
    global processed_conversation_blocks
    global FILEPATH
    global GLOSSARY_FILEPATH
    global SUMMARIES_FILEPATH
    global glossary
    # Open the file dialog for selecting a file
    FILEPATH = filedialog.askopenfilename(
        title="Select Discord Messages File",
        filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
    )
    GLOSSARY_FILEPATH = f"GLOSSARY/GLOSSARY_{os.path.basename(FILEPATH)}"
    SUMMARIES_FILEPATH =f"SUMMARY/SUMMARY_{os.path.basename(FILEPATH)}"
    output_text_display.delete('1.0', tk.END)  # Clear the text display
    output_text_display.insert(tk.END, f"Loaded {os.path.basename(FILEPATH)}!\n")

    # Check if a file was selected
    if not FILEPATH:
        print("No file selected.")
        return
    

    with open(FILEPATH, encoding="utf-8") as discord_messages_file:
        discord_message_data = json.load(discord_messages_file)
    
    # Load and preprocess conversation blocks in one step
    conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)

    try:
        glossary = {}
        with open(GLOSSARY_FILEPATH, 'r', encoding='utf-8') as file:
            glossary = json.load(file)
            output_text_display.insert(tk.END, f"Loaded {os.path.basename(GLOSSARY_FILEPATH)}!\n")
            print("Glossary FOUND!")
            update_clustering(glossary_tree, 0.0, glossary)
            def load():
                load_summary_from_file()
                display_summary_popup()
            app_main_window.after(500,load)

        return
    except:
        glossary = {}
        update_clustering(glossary_tree, 0.0, glossary)
        pass
    

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


                for query_word, bag_of_words_around_matched_query_in_child_message_block in matched_words.items():

                    # Expand the list of current words for further recursion (avoiding duplicates)
                    expanded_word_bag = inherited_words_bag + list(set(processed_conversation_blocks[block_index].split()) - set(inherited_words_bag))

                    # Recursively process the next message block with reduced search radius

                    construct_context_chain(expanded_word_bag, max(search_radius // 2, 1), block_index, visited_indices, context_chain,  recursion_depth + 1)


conversation_topic_tree = {}
def generate_and_display_all_random_context_chain():
    """
    Autonomously finds and generates context chains for all conversations.
    Ensures no duplicate processing for conversations already found.
    """

    global found_id
    global conversation_topic_tree

    found_id = set()
    conversation_topic_tree = {}
    print(len(processed_conversation_blocks))


    for index in range(len(processed_conversation_blocks)):

        if index not in found_id:
            
    
            generate_and_display_random_context_chain2(index)


    # Create a new thread to run the generate_glossary function
    processing_thread = threading.Thread(target=generate_glossary)
    processing_thread.daemon = True  # Daemon thread will exit when the main program exits
    processing_thread.start()

    print(f"Number of Chains:{i}")


i = 0 

def generate_and_display_random_context_chain2(index=None):
    global i
    global found_id
    global conversation_topic_tree

    """
    Generates and displays a context chain for a specific conversation block.
    If `index` is provided, it processes that specific conversation block; otherwise, 
    it picks a random block to process.
    """
    try:
        # Get the context search radius from the input field
        search_radius = int(context_radius_input.get())
    except ValueError:
        output_text_display.insert(tk.END, "Please enter a valid number for context search radius.\n")
        return

    if processed_conversation_blocks:
        block_index = index
        block_words = processed_conversation_blocks[block_index].split()
        visited_block_indices = {block_index}  # Keep track of visited blocks to avoid cycles
        context_chain = [(block_index, conversation_blocks[block_index], 1)]  # Initialize the context chain

        # Construct the context chain using the helper function
        construct_context_chain(block_words, search_radius, block_index, visited_block_indices, context_chain)

        # If the chain is too short and `index` was specified, stop processing this block
        if len(context_chain) < search_radius // 4 and index is not None:
            found_id.add(index)
            return


        context_chain.sort()
        topic_id = str(block_index)
        conversation_topic_tree[topic_id] = [
            {"message": msg, "message_id": blk_id} for blk_id, msg,_ in context_chain
        ]
        found_id.update(blk_id for blk_id, _,_ in context_chain)
        i += 1




def generate_conversation_topics():
    """
    Processes topics in the conversation glossary_tree and extracts descriptions.
    """
    global conversation_topic_tree

    if not conversation_topic_tree:
        output_text_display.insert(tk.END, "\nNo topics available to process.\n")
        return
    
    i = 0
    for topic_id, convo in conversation_topic_tree.items():
        total = "\n".join(
            processed_conversation_blocks[entry["message_id"]] for entry in convo
        )
        description = extract_topics(total)
        convo.append({"description": description})
        print(f"Next: {i}")
        i+=1

def construct_glossary():
    """
    Updates the glossary with keywords mapped to message IDs.
    """
    global conversation_topic_tree, glossary

    if not conversation_topic_tree:
        return

    for topic_id, topic_data in conversation_topic_tree.items():
        description = topic_data[-1].get("description", "")  # Assume last entry is the description
        if not description:
            print("not here")
            continue


        keywords = description
        message_ids = [entry["message_id"] for entry in topic_data if "message_id" in entry]

        for keyword in keywords:
            if keyword not in glossary:
                glossary[keyword] = []  # Initialize as an empty list
            glossary[keyword].append(message_ids)  # Append the message_ids array to the list




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

        convo_block = glossary.get(topic_name,"")[conversation_number]
        for message_id in convo_block:
            # Fetch the message from the conversation block using message_id
            message = conversation_blocks[message_id]
            
            # Display the message with separator
            output_text_display.insert(tk.END, f"{message}\n{'-' * 50}\n")



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
        search = f"{glossary_tree.item(glossary_tree.selection())['text']}_{conversation_spinbox.get()}"
        if search not in summary_array_html_results:
            ChatGPT.send_message(
                "sendGPT",
                "Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response. If possible break it into subheadings:" + context_chain_text,
                learn=True
            )
        else:
            print(f"Found in results {search}")
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {e}")


prev_key = None

# Function to display the summary in a popup window
def display_summary_popup():



    # Function to handle page navigation
    def go_to_page(direction):
        global prev_key  # Make sure we are using the global prev_key

        if summary_array_html_results is {} or direction == 0:
            return
        try:
            # If prev_key is set, navigate to the next page based on it
            if prev_key is None:
                # Start from the first page if prev_key is None
                selected_page = list(summary_array_html_results.keys())[0]
            else:
                # Get the next page in the sequence
                page_keys = list(summary_array_html_results.keys())
                current_index = page_keys.index(prev_key)
                selected_page = page_keys[min(len(page_keys)-1,max(0,current_index + direction))]  # Cycle back to the first page after the last one

            prev_key = selected_page  # Update prev_key to the newly selected page

            # Update HTML content for the selected page (dummy logic for now)
            new_html_result = generator.generate_and_display_html("", summary_array_html_results[selected_page], theme="ocean")
            summary_display.load_html(new_html_result)

            page_parts = selected_page.split('_')
            if len(page_parts) >= 2:
                summary_popup.title(f"Summary: {page_parts[0].upper()} Conversation: {page_parts[1]}")

        except (ValueError, KeyError, IndexError) as e:
            messagebox.showerror("Invalid Input", "Please select a valid page.")

    if app_main_window.Discord_Summary_Window_Created:
        app_main_window.Discord_Summary_Window_Created.lift()


    else:
        summary_popup = tk.Toplevel(app_main_window)
        summary_popup.title(f"Summary: {glossary_tree.item(glossary_tree.selection())['text'].upper()} Conversation: {conversation_spinbox.get()}")
        summary_popup.geometry("900x600")
        summary_popup.bind("<Control-s>", lambda event: save_summary())

        # Define the function to execute when the popup window is closed
        def on_popup_close():
            app_main_window.Discord_Summary_Window_Created = None
            summary_popup.destroy()

        summary_popup.protocol("WM_DELETE_WINDOW", on_popup_close)

        # Bind left and right arrow keys to change the page
        def on_left_arrow(event):
            print("Left")
            go_to_page(-1)

        def on_right_arrow(event):
            print("right")
            go_to_page(1)

        summary_popup.bind("<Left>", on_left_arrow)
        summary_popup.bind("<Right>", on_right_arrow)

        # HTML Frame to display the summary

        summary_display = HtmlFrame(summary_popup, horizontal_scrollbar="auto")



        # Function to scroll the HtmlFrame up
        def scroll_up(event):
            summary_display.yview_scroll(-1, "units")  # Scroll up by one unit

        # Function to scroll the HtmlFrame down
        def scroll_down(event):
            summary_display.yview_scroll(1, "units")  # Scroll down by one unit

        # Bind the Up and Down arrow keys to scroll the HtmlFrame
        summary_popup.bind("<Down>", scroll_down)
        summary_popup.bind("<Up>", scroll_up)

        # Frame for navigation controls
        nav_frame = tk.Frame(summary_popup)
        nav_frame.pack(side=tk.BOTTOM, fill=tk.X, pady=10)



        # conversation_spinbox for navigating summary pages
        page_spinbox = ttk.Spinbox(
            nav_frame,
            from_=0,
            to=default_settings["num_pages_summary"]-1,
            width=5,
            state="readonly",command=lambda event=None:go_to_page(1)
        )
        page_spinbox.config(takefocus=0)    
        page_spinbox.set(0)  # Set default page to 1
        page_spinbox.pack(side=tk.RIGHT, padx=5)




        tk.Label(nav_frame, text="Page:").pack(side=tk.RIGHT, padx=5)

        summary_display.pack(padx=10, pady=10, fill="both", expand=True)

        app_main_window.Discord_Summary_Window_Created=summary_display

        go_to_page(0)


    #app_main_window.Discord_Summary_Window_Created.load_html(html_result)



summary_array_html_results={}
def load_summary_from_file():
    global summary_array_html_results  # Use the global variable
    try:
        with open(SUMMARIES_FILEPATH, 'r') as file:
            summary_array_html_results = json.load(file)  # Assuming the file contains JSON data
            print("Summaries loaded successfully!")
            output_text_display.insert(tk.END, f"Loaded {os.path.basename(SUMMARIES_FILEPATH)}!\n")
    except FileNotFoundError:
        print(f"Error: The file '{SUMMARIES_FILEPATH}' was not found.")

# Callback to handle the initial response from ChatGPT
def handle_incoming_summary_response(summary):
    global summary_array_html_results

    try:
        # Ensure a summary was received
        if not summary:
            messagebox.showwarning("Warning", "No summary received from ChatGPT.")
            return

        current_page = int(conversation_spinbox.get())
        selected_item = glossary_tree.item(glossary_tree.selection())['text']
        max_topic_pages = len(glossary[selected_item]) if selected_item in glossary else 0

        if "initial" not in handle_incoming_summary_response.__dict__:
            handle_incoming_summary_response.initial = current_page
            # Generate the HTML result
            html_result = generator.generate_and_display_html("", summary, theme="ocean")
            app_main_window.after(0, display_summary_popup)

        summary_array_html_results[f"{selected_item}_{conversation_spinbox.get()}"] = summary

        def next_page():
            try:

                upper_limit = int(conversation_spinbox["to"])
                conversation_spinbox.delete(0, "end")  # Clear the current value
                conversation_spinbox.insert(0, str(min(current_page+1,upper_limit)))  # Insert the new value

                item_name = glossary_tree.item(glossary_tree.selection())['text']
                display_selected_glossary(item_name,int(conversation_spinbox.get()))  # Call the function with the selected item name

                summarize_context_chain()
            except Exception as e:
                messagebox.showerror("Error", f"An error occurred: {str(e)}")


        # Check if further navigation is possible
        # -1 cause first one in initial
        if current_page < default_settings["num_pages_summary"] + handle_incoming_summary_response.initial-1 and current_page < max_topic_pages:
            app_main_window.after(0, next_page)
        else:

            del handle_incoming_summary_response.initial


            upper_limit = int(conversation_spinbox["to"])
            conversation_spinbox.delete(0, "end")  # Clear the current value
            conversation_spinbox.insert(0, str(min(current_page+1,upper_limit)))  # Insert the new value

    except Exception as e:
        messagebox.showerror("Error", f"An unexpected error occurred: {str(e)}")




# Initialize Tkinter GUI
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("1200x600")
app_main_window.Discord_Summary_Window_Created = None


glossary = {}
def save_glossary():
    with open(GLOSSARY_FILEPATH, 'w') as f:
        json.dump(glossary, f, indent=4)
    print(f"Glossary generated and saved to {GLOSSARY_FILEPATH}")

def save_summary():
    with open(SUMMARIES_FILEPATH, 'w') as f:
        json.dump(summary_array_html_results, f, indent=4)
    print(f"Summaries saved to {SUMMARIES_FILEPATH}")



from glossary_compression import  efficient_overlap_and_merge, compress_glossary_entries
def intersect_compressor(data):
    print("Compressing...")
    # Iterate through the data and compress each glossary entry

    complete_start = time.time()
    for keyword in data:
        data[keyword] = compress_glossary_entries(keyword, data[keyword],0.7)

    print(f"End of end: {time.time() - complete_start}")
    return data  # Ensure the modified data is returned

def generate_glossary():
    global glossary
    glossary = {}

    generate_conversation_topics()
    construct_glossary()
    glossary = intersect_compressor(glossary)
    update_clustering(glossary_tree, 0.0, glossary)

def show_glossary():
    hide_all_frames()
    print("Showing Glossary")
    glossary_frame.pack(side=tk.RIGHT, padx=10, pady=10, fill='y', expand=False)

def show_graphs():
    hide_all_frames()
    print("Showing Graphs")
    graph_frame.pack()




# Dictionary to store the default settings
default_settings = {
    "num_pages_summary": 5  # Default number of pages for the summary
}



# Function to open the settings dialog box
def open_settings_dialog():
    # Create a new Toplevel window for General settings
    settings_window = tk.Toplevel(app_main_window)
    settings_window.title("Settings - General")
    settings_window.geometry("300x200")

    # Display each setting with an entry field
    for setting_name, setting_value in default_settings.items():
        frame = tk.Frame(settings_window)
        frame.pack(pady=5, fill="x")

        tk.Label(frame, text=setting_name).pack(side="left", padx=10)
        
        value_entry = tk.Entry(frame)
        value_entry.insert(0, str(setting_value))
        value_entry.pack(side="left", padx=5)

        # Store a reference to the current entry widget
        frame.value_entry = value_entry


    def apply_settings():
        try:
            for frame in settings_window.winfo_children():
                if isinstance(frame, tk.Frame):
                    # Get all child widgets in the frame
                    children = frame.winfo_children()
                    print(children)
                    # Ensure the frame contains at least a Label and an Entry
                    if len(children) < 2:
                        break
                        #raise ValueError("Invalid frame structure: each frame must have a Label and an Entry.")
                    
                    label = children[0]  # Assuming the first child is the Label
                    entry = children[1]  # Assuming the second child is the Entry
                    
                    # Ensure the widgets are of the correct types
                    if not isinstance(label, tk.Label) or not isinstance(entry, (tk.Entry, ttk.Entry)):
                        raise ValueError("Invalid frame content: expected a Label and an Entry widget.")

                    # Get setting name and value
                    setting_name = label.cget("text")
                    new_value = int(entry.get())  # Get the value entered in the entry widget
                    
                    if new_value < 0:
                        raise ValueError(f"{setting_name} must be positive.")
                    
                    # Update the settings dictionary
                    default_settings[setting_name] = new_value
                    print(f"Updated {setting_name}: {new_value}")
            
            settings_window.destroy()  # Close the settings window
        except ValueError as e:
            messagebox.showerror("Invalid Input", f"Error: {e}")
        except Exception as e:
            messagebox.showerror("Unexpected Error", f"An error occurred: {str(e)}")

    # Frame to contain the Apply button
    button_frame = tk.Frame(settings_window)
    button_frame.pack(side=tk.BOTTOM, fill=tk.X, pady=10)  # Positioned at the bottom and spans horizontally

    # Apply button aligned to the right
    tk.Button(button_frame, text="Apply", command=apply_settings).pack(side=tk.RIGHT, padx=10)



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

generate_menu = tk.Menu(menu_bar, tearoff=0)
generate_menu.add_command(label="Generate Context Chain", command=generate_context_chain, accelerator="Ctrl+L")

summarize_menu = tk.Menu(menu_bar, tearoff=0)
summarize_menu.add_command(label="Summarize", command=summarize_context_chain, accelerator="Ctrl+G")

file_menu = tk.Menu(menu_bar, tearoff=0)
file_menu.add_command(label="Load Conversation", command=load_conversation)
file_menu.add_command(label="Save Glossary", command=save_glossary, accelerator="Ctrl+S")
file_menu.add_command(label="Save Conversation Summaries", command=save_summary, accelerator="Ctrl+Shift+S")
file_menu.add_separator()
file_menu.add_command(label="Exit", command=app_main_window.quit, accelerator="Ctrl+Q")

tools_menu = tk.Menu(menu_bar, tearoff=0)
tools_menu.add_radiobutton(label="Show Glossary", value="Show Glossary", command=show_glossary)
tools_menu.add_radiobutton(label="Show Graphs", command=show_graphs)


# Add the Settings menu
settings_menu = tk.Menu(menu_bar, tearoff=0)
settings_menu.add_command(label="General", command=open_settings_dialog)  # Open the dialog box when clicked


menu_bar.add_cascade(label="File", menu=file_menu)
menu_bar.add_cascade(label="Generate", menu=generate_menu)
menu_bar.add_cascade(label="Summarize", menu=summarize_menu)
menu_bar.add_cascade(label="Tools", menu=tools_menu)
menu_bar.add_cascade(label="Settings",menu=settings_menu)
app_main_window.config(menu=menu_bar)
app_main_window.bind('<Control-l>', lambda event: generate_context_chain())
app_main_window.bind('<Control-s>', lambda event: save_glossary())
app_main_window.bind('<Control-g>', lambda event: summarize_context_chain())
app_main_window.bind('<Control-q>', lambda event: app_main_window.quit())
app_main_window.bind('<Control-Shift-S>', lambda event: save_summary())



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
# Bind left and right arrow keys to change the page




# Function to handle left arrow key (decrease the value within the limits)
def on_left_arrow(event):
    try:
        current_value = int(conversation_spinbox.get())  # Get the current value of the Spinbox
        if current_value > conversation_spinbox["from"]:  # Check if we can decrease
            new_value = current_value - 1
            conversation_spinbox.delete(0, "end")  # Clear the current value
            conversation_spinbox.insert(0, str(new_value))  # Insert the new value
            on_glossary_treeview_select(None)
            print(f"Left Arrow: {new_value}")
        else:
            print("Left Arrow: Already at minimum")
    except ValueError:
        print("Error: Invalid value in Spinbox")

# Function to handle right arrow key (increase the value within the limits)
def on_right_arrow(event):
    try:
        current_value = int(conversation_spinbox.get())  # Get the current value of the Spinbox
        if current_value < conversation_spinbox["to"]:  # Check if we can increase
            new_value = current_value + 1
            conversation_spinbox.delete(0, "end")  # Clear the current value
            conversation_spinbox.insert(0, str(new_value))  # Insert the new value
            on_glossary_treeview_select(None)
            print(f"Right Arrow: {new_value}")
        else:
            print("Right Arrow: Already at maximum")
    except ValueError:
        print("Error: Invalid value in Spinbox")


# Function to handle scrolling (scrolls the output_text_display widget)
def scroll_up(event):
    output_text_display.yview_scroll(-1, "units")  # Scroll up by 1 unit

def scroll_down(event):
    output_text_display.yview_scroll(1, "units")  # Scroll down by 1 unit

output_text_display.bind("<Left>", on_left_arrow)
output_text_display.bind("<Right>", on_right_arrow)
output_text_display.bind("<Up>", scroll_up)
output_text_display.bind("<Down>", scroll_down)

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
    selected_item = glossary_tree.selection()  # Get the selected item (ID or name)
    if selected_item:
        item_name = glossary_tree.item(selected_item[0])['text']  # Get the text (name) of the selected item
        gl_len=len(glossary[item_name])-1
        update_glossary_upper_limit(gl_len)
        gl_now = min(int(conversation_spinbox.get()),gl_len)
        conversation_spinbox.delete(0, "end")  # Clear the current value
        conversation_spinbox.insert(0, gl_now)  # Insert the new value

        display_selected_glossary(item_name,int(conversation_spinbox.get()))  # Call the function with the selected item name

# Create a Treeview widget
glossary_tree = ttk.Treeview(glossary_frame)
glossary_tree.heading("#0", text="Glossary", anchor="w")
glossary_tree.bind("<<TreeviewSelect>>", on_glossary_treeview_select)
glossary_tree.pack(fill="both", expand=True)


def update_glossary_upper_limit(limit_num):
    conversation_spinbox.config(to=limit_num)  # Dynamically set the upper limit


# Create a Spinbox widget for selecting numbers
conversation_spinbox = tk.Spinbox(glossary_frame, from_=0, to=1, increment=1, width=5, command=lambda event=None:on_glossary_treeview_select(event))
conversation_spinbox.pack(fill="x")




# Initialize ChatGPT WebSocket client and register callback
ChatGPT = OpenAICMD.WebSocketClientApp("https://ninth-swamp-orangutan.glitch.me")
ChatGPT.register_callback(callback=lambda summary: handle_incoming_summary_response(summary))
generator = HTMLStyling.HTMLGenerator()


#objgraph.show_most_common_types()  # This will show the most common types in memory
# Start the Tkinter GUI loop
app_main_window.mainloop()
