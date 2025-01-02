import re
import html
import time
import os
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from tkinterweb import HtmlFrame
from Special import OpenAICMD, HTMLStyling
from textrank4zh import TextRank4Keyword
import json
from kneed import KneeLocator
from GroupTheoryAPI2 import *
import threading
from tkinter import filedialog

from ModifiedNotebook import Notebook
from nltk.stem import PorterStemmer
from textblob import TextBlob
text_rank = TextRank4Keyword()  # Initialize TextRank globally
text_rank.analyze("Removing cold start", window=5, lower=True) #Here to reduce cold start



# Load the spaCy model for English

from textblob import TextBlob

def filter_words_by_Part_Of_Speech_Tag(words, pos_tags):
    """
    Filters words from an array based on the given list of POS tags.
    
    :param words: A list of words (strings).
    :param pos_tags: A list of POS tags to keep (e.g., ['NN', 'VB']).
    :return: A list of words that match the specified POS tags.
    """
    # Join the words into a single string to process them with TextBlob
    text = ' '.join(words)

    # Create a TextBlob object and tag parts of speech
    blob = TextBlob(text)
    tagged = blob.tags  # List of tuples (word, POS tag)

    # Filter words based on the specified POS tags
    filtered_words = [str(word) for word, tag in tagged if tag in pos_tags]

    return filtered_words

def extract_topics(text,visualize=False):
    """
    Extract keywords from the text and visualize the elbow/knee for keyword selection.
    
    Args:
        text (str): The input text to analyze.
        p
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

    # Select keywords up to the cutoff point
    optimal_keywords = [kw.word for kw in keywords[:cutoff]]

    pos_to_keep = ['NOUN','PROPN']# 'VERB']
    pos_to_keep = ["NN"]
    filtered_words = filter_words_by_Part_Of_Speech_Tag(optimal_keywords, pos_to_keep)
    print(filtered_words)
    return filtered_words



FILEPATH = None
GLOSSARY_FILEPATH = None
SUMMARIES_FILEPATH = None
MESSAGE_SEPARATOR = '--------------------------------------------------'
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

punctuations=r"""",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“`"""

print(punctuations)

# Function to preprocess message text: removes stopwords, strips punctuation, and applies stemming
def remove_stopwords_from_message_text(message_text):

    result = []

    words = message_text.translate(str.maketrans('', '', punctuations)).split()

    # Loop through each word
    for word in words:

        # If the word starts with 'https' (a URL), split it by '/'
        if word.lower().startswith('http'):
            # Translate specified characters into spaces
            translated_text = word.translate(str.maketrans(":/. -", "     "))

            result.extend(
                part for part in translated_text.split(' ')
                if not part.lower().startswith('http') and part.lower() not in {'com', 'www','ai'} and part.lower() not in loaded_stopwords
            )
        # If the word is not a stopword or is uppercase (longer than 1 char), add it to the result
        elif word.lower() not in loaded_stopwords or (word.isupper() and len(word) > 1):
            result.append(word)

    return result


# Group and preprocess messages by author to form conversation blocks
def group_and_preprocess_messages_by_author(message_data):

    LIMIT = 3
    conversation_blocks = []  # Will store original blocks
    processed_conversation_blocks = []  # Will store preprocessed blocks
    current_author = None
    author_messages = []

    #Handle yet another data format
    if isinstance(message_data, dict) and "messages" in message_data:
        message_data = message_data["messages"]
    DLimit = -1 #To prevent from collate lots of text from one auto=hor as simply one block
    for message_entry in message_data:
        if "content" in message_entry and "author" in message_entry and "name" in message_entry["author"]:
            author_name = message_entry["author"]["name"]

            # If the author changes, process and save the previous block
            if author_name != current_author or (DLimit == LIMIT):
                DLimit = 0
                if author_messages:
                    # Join the author's messages into one block
                    joined_message_block = " ".join(author_messages)

                    # Store the original conversation block
                    conversation_blocks.append(joined_message_block)

                    # Store the preprocessed conversation block
                    preprocessed_block = " ".join(remove_stopwords_from_message_text(joined_message_block))
                    processed_conversation_blocks.append(preprocessed_block)

                # Reset for the new author
                current_author = author_name
                author_messages = []

            # Append current message content to the author's block
            author_messages.append(message_entry["content"])
            DLimit+=1

        elif "content" in message_entry and "author" in message_entry and "username" in message_entry["author"]:
            author_name = message_entry["author"]["username"]


            # If the author changes, process and save the previous block
            if author_name != current_author or (DLimit == LIMIT):
                DLimit = 0
                if author_messages:
                    # Join the author's messages into one block
                    joined_message_block = " ".join(author_messages)

                    # Store the original conversation block
                    conversation_blocks.append(joined_message_block)

                    # Store the preprocessed conversation block
                    preprocessed_block = " ".join(remove_stopwords_from_message_text(joined_message_block))
                    processed_conversation_blocks.append(preprocessed_block)

                # Reset for the new author
                current_author = author_name
                author_messages = []

            # Append current message content to the author's block
            author_messages.append(message_entry["content"])
            DLimit +=1
    # Append the last block of messages
    if author_messages:
        joined_message_block = " ".join(author_messages)
        conversation_blocks.append(joined_message_block)

        preprocessed_block = " ".join(remove_stopwords_from_message_text(joined_message_block))
        processed_conversation_blocks.append(preprocessed_block)

    return conversation_blocks, processed_conversation_blocks



# Load and preprocess conversation blocks in one step
#conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)





def load_conversation():
    global conversation_blocks
    global processed_conversation_blocks
    global FILEPATH
    global GLOSSARY_FILEPATH
    global SUMMARIES_FILEPATH
    global dictionary_glossary_topic_and_linked_conversation_groups
    global summary_array_html_results
    summary_array_html_results = {}
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
        file_content = discord_messages_file.read()


    # Check if the file content is JSON
    try:
        print("DR")
        discord_message_data = json.loads(file_content)
        is_json = True
    except json.JSONDecodeError:
        print("NOT h")
        is_json = False

    # Preprocess the messages based on the type of data
    if is_json:
        print("HEHE")
        conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)
    else:
        message_log = file_content.splitlines()
        conversation_blocks, processed_conversation_blocks = process_messages_whatsapp_format(message_log)


    try:
        dictionary_glossary_topic_and_linked_conversation_groups = {}
        with open(GLOSSARY_FILEPATH, 'r', encoding='utf-8') as file:
            dictionary_glossary_topic_and_linked_conversation_groups = json.load(file)
            output_text_display.insert(tk.END, f"Loaded {os.path.basename(GLOSSARY_FILEPATH)}!\n")
            print("Glossary FOUND!")
            generate_subtopic_tree_and_display_tree(glossary_tree, 0.0, dictionary_glossary_topic_and_linked_conversation_groups)
            def load():
                load_summary_from_file()
                if app_main_window.Discord_Summary_Window_Created:
                    app_main_window.Discord_Summary_Window_Created.event_generate("<Destroy>")
                    app_main_window.Discord_Summary_Window_Created = None
                display_summary_popup()
            app_main_window.after(500,load)

        return
    except:
        dictionary_glossary_topic_and_linked_conversation_groups = {}
        generate_subtopic_tree_and_display_tree(glossary_tree, 0.0, dictionary_glossary_topic_and_linked_conversation_groups)
        pass





# Optimized function to search for a query within a message block using set operations
def find_query_in_message_block(query_set, message_block):
    # Split the message block into words and create a set for fast lookup
    message_block_words = set(message_block.split())

    # Check for any intersection between the query set and the message block words
    return not query_set.isdisjoint(message_block_words)

# Optimized recursive function to construct context chain with probability updates
def construct_context_chain(inherited_words_set, search_radius, current_message_index, visited_indices, context_chain, recursion_depth=1):
    # Calculate the range of messages to search within based on the search radius
    start_index = max(0, current_message_index - search_radius)
    end_index = min(len(processed_conversation_blocks), current_message_index + search_radius + 1)

    # Iterate through the conversation blocks within the search range
    for block_index in range(start_index, end_index):
        if block_index not in visited_indices:
            # Find matches in the current block
            if find_query_in_message_block(inherited_words_set, processed_conversation_blocks[block_index]):
                visited_indices.add(block_index)
                context_chain.append((block_index, conversation_blocks[block_index], recursion_depth))

                # Expand the inherited word set for further recursion
                expanded_word_set = inherited_words_set.union(
                    processed_conversation_blocks[block_index].split()
                )

                # Recursively process the next message block with reduced search radius
                construct_context_chain(expanded_word_set, max(search_radius // 2, 1), block_index, visited_indices, context_chain, recursion_depth + 1)


dictionary_seed_conversation_and_generated_chain = {}
def generate_and_display_all_random_context_chain():
    """
    Autonomously finds and generates context chains for all conversations.
    Ensures no duplicate processing for conversations already found.
    """

    global set_ids_of_found_conversations
    global dictionary_seed_conversation_and_generated_chain

    set_ids_of_found_conversations = set()
    dictionary_seed_conversation_and_generated_chain = {}
    print("Again",len(processed_conversation_blocks))


    for index in range(len(processed_conversation_blocks)):

        if index not in set_ids_of_found_conversations:
            
    
            generate_and_display_random_context_chain2(index)


    # Create a new thread to run the calculate_then_display_glossary function
    processing_thread = threading.Thread(target=calculate_then_display_glossary)
    processing_thread.daemon = True  # Daemon thread will exit when the main program exits
    processing_thread.start()

    print(f"Number of Chains:{i}")


def generate_and_display_random_context_chain2(index=None):

    global set_ids_of_found_conversations
    global dictionary_seed_conversation_and_generated_chain

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
        block_words = set(processed_conversation_blocks[block_index].split())
        visited_block_indices = {block_index}  # Keep track of visited blocks to avoid cycles
        context_chain = [(block_index, conversation_blocks[block_index], 1)]  # Initialize the context chain

        # Construct the context chain using the helper function
        construct_context_chain(block_words, search_radius, block_index, visited_block_indices, context_chain)

        # If the chain is too short and `index` was specified, stop processing this block
        if len(context_chain) < search_radius // 4 and index is not None:
            set_ids_of_found_conversations.add(index)
            return


        context_chain.sort()
        topic_id = str(block_index)
        dictionary_seed_conversation_and_generated_chain[topic_id] = [
            {"message": msg, "message_id": blk_id} for blk_id, msg,_ in context_chain
        ]
        set_ids_of_found_conversations.update(blk_id for blk_id, _,_ in context_chain)
        i += 1




def calculate_topics_for_each_message():
    """
    Processes topics in the conversation glossary_tree and extracts descriptions.
    """
    global dictionary_seed_conversation_and_generated_chain

    if not dictionary_seed_conversation_and_generated_chain:
        output_text_display.insert(tk.END, "\nNo topics available to process.\n")
        return
    
    i = 0
    for topic_id, convo in dictionary_seed_conversation_and_generated_chain.items():
        total = "\n".join(
            processed_conversation_blocks[entry["message_id"]] for entry in convo
        )
        description = extract_topics(total)
        convo.append({"description": description})
        print(f"Next: {i}")
        i+=1

def assign_each_topic_relevant_message_groups():
    """
    Updates the dictionary_glossary_topic_and_linked_conversation_groups with keywords mapped to message IDs.
    """
    global dictionary_seed_conversation_and_generated_chain, dictionary_glossary_topic_and_linked_conversation_groups

    if not dictionary_seed_conversation_and_generated_chain:
        return

    for topic_id, topic_data in dictionary_seed_conversation_and_generated_chain.items():
        description = topic_data[-1].get("description", "")  # Assume last entry is the description
        if not description:
            print("not here")
            continue


        keywords = description
        message_ids = [entry["message_id"] for entry in topic_data if "message_id" in entry]

        for keyword in keywords:
            if keyword not in dictionary_glossary_topic_and_linked_conversation_groups:
                dictionary_glossary_topic_and_linked_conversation_groups[keyword] = []  # Initialize as an empty list
            dictionary_glossary_topic_and_linked_conversation_groups[keyword].append(message_ids)  # Append the message_ids array to the list




def display_conversations_linked_to_selected_topic(item,conversation_number):
    """
    Displays the selected dictionary_glossary_topic_and_linked_conversation_groups item and its associated conversation blocks.
    
    :param item: The selected dictionary_glossary_topic_and_linked_conversation_groups item (topic or ID) to be displayed.
    """
    output_text_display.delete('1.0', tk.END)  # Clear the text display
    

    topic_name = item  # If the item is an ID, you might need to map it to the dictionary_glossary_topic_and_linked_conversation_groups data
    
    # Display parent node's topic
    output_text_display.insert(tk.END, f"Topic: {topic_name}\n")
    output_text_display.insert(tk.END, "-" * 50 + "\n")
    
    # Display associated conversation blocks for this topic
    if topic_name in dictionary_glossary_topic_and_linked_conversation_groups:

        convo_block = dictionary_glossary_topic_and_linked_conversation_groups.get(topic_name,"")[conversation_number]
        for message_id in convo_block:
            # Fetch the message from the conversation block using message_id
            message = conversation_blocks[message_id]
            
            # Display the message with separator
            output_text_display.insert(tk.END, f"DMessage {message_id}:{message}\n{MESSAGE_SEPARATOR}\n")

prev_key = None






dictionary_glossary_topic_and_linked_conversation_groups = {}



from glossary_compression import  efficient_overlap_and_merge, compress_glossary_entries
def intersect_compressor(data):
    print("Compressing...")
    # Iterate through the data and compress each dictionary_glossary_topic_and_linked_conversation_groups entry

    complete_start = time.time()
    for keyword in data:
        data[keyword] = compress_glossary_entries(keyword, data[keyword],0.7)

    print(f"End of end: {time.time() - complete_start}")
    return data  # Ensure the modified data is returned

def calculate_then_display_glossary():
    global dictionary_glossary_topic_and_linked_conversation_groups
    dictionary_glossary_topic_and_linked_conversation_groups = {}

    calculate_topics_for_each_message()
    assign_each_topic_relevant_message_groups()
    dictionary_glossary_topic_and_linked_conversation_groups = intersect_compressor(dictionary_glossary_topic_and_linked_conversation_groups)
    generate_subtopic_tree_and_display_tree(glossary_tree, 0.0, dictionary_glossary_topic_and_linked_conversation_groups)





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




# Initialize Tkinter GUI
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("1200x600")
app_main_window.Discord_Summary_Window_Created = None


# Initialize Menu bar
menu_bar = tk.Menu(app_main_window)

generate_menu = tk.Menu(menu_bar, tearoff=0)
generate_menu.add_command(label="Generate Context Chain", command=generate_and_display_all_random_context_chain, accelerator="Ctrl+L")


file_menu = tk.Menu(menu_bar, tearoff=0)
file_menu.add_command(label="Load Conversation", command=load_conversation)

file_menu.add_separator()
file_menu.add_command(label="Exit", command=app_main_window.quit, accelerator="Ctrl+Q")


# Add the Settings menu
settings_menu = tk.Menu(menu_bar, tearoff=0)
settings_menu.add_command(label="General", command=open_settings_dialog)  # Open the dialog box when clicked


menu_bar.add_cascade(label="File", menu=file_menu)
menu_bar.add_cascade(label="Generate", menu=generate_menu)

menu_bar.add_cascade(label="Settings",menu=settings_menu)
app_main_window.config(menu=menu_bar)
app_main_window.bind('<Control-l>', lambda event: generate_and_display_all_random_context_chain())

app_main_window.bind('<Control-q>', lambda event: app_main_window.quit())



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
def on_left_arrow_within_conversation_pane(event):
    try:
        current_value = int(conversation_spinbox.get())  # Get the current value of the Spinbox
        if current_value > conversation_spinbox["from"]:  # Check if we can decrease
            new_value = current_value - 1
            conversation_spinbox.delete(0, "end")  # Clear the current value
            conversation_spinbox.insert(0, str(new_value))  # Insert the new value
            on_glossary_treeview_select(None)

        else:
            print("Left Arrow: Already at minimum")
    except ValueError:
        print("Error: Invalid value in Spinbox")

# Function to handle right arrow key (increase the value within the limits)
def on_right_arrow_within_conversation_pane(event):
    try:
        current_value = int(conversation_spinbox.get())  # Get the current value of the Spinbox
        if current_value < conversation_spinbox["to"]:  # Check if we can increase
            new_value = current_value + 1
            conversation_spinbox.delete(0, "end")  # Clear the current value
            conversation_spinbox.insert(0, str(new_value))  # Insert the new value
            on_glossary_treeview_select(None)

        else:
            print("Right Arrow: Already at maximum")
    except ValueError:
        print("Error: Invalid value in Spinbox")


# Function to handle scrolling (scrolls the output_text_display widget)
def scroll_up(event):
    output_text_display.yview_scroll(-1, "units")  # Scroll up by 1 unit

def scroll_down(event):
    output_text_display.yview_scroll(1, "units")  # Scroll down by 1 unit

output_text_display.bind("<Left>", on_left_arrow_within_conversation_pane)
output_text_display.bind("<Right>", on_right_arrow_within_conversation_pane)
output_text_display.bind("<Up>", scroll_up)
output_text_display.bind("<Down>", scroll_down)


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
        gl_len=len(dictionary_glossary_topic_and_linked_conversation_groups[item_name])-1
        update_glossary_upper_limit(gl_len)
        gl_now = min(int(conversation_spinbox.get()),gl_len)
        conversation_spinbox.delete(0, "end")  # Clear the current value
        conversation_spinbox.insert(0, gl_now)  # Insert the new value

        num_conversations_widget.delete('1.0', tk.END)  # Clear all text
        num_conversations_widget.insert(tk.END, str(gl_len+1))  # Insert the selected dictionary_glossary_topic_and_linked_conversation_groups entry


        display_conversations_linked_to_selected_topic(item_name,int(conversation_spinbox.get()))  # Call the function with the selected item name

# Create a Treeview widget
glossary_tree = ttk.Treeview(glossary_frame)
glossary_tree.heading("#0", text="Glossary", anchor="w")
glossary_tree.bind("<<TreeviewSelect>>", on_glossary_treeview_select)
glossary_tree.pack(fill="both", expand=True)


def update_glossary_upper_limit(limit_num):
    conversation_spinbox.config(to=limit_num)  # Dynamically set the upper limit

# Create a frame for positioning widgets
frame = tk.Frame(glossary_frame)
frame.pack(fill="x", padx=0, pady=10)  # Pack the frame with some padding
# Label on the left side
label = tk.Label(frame, text="Num Conversations")
label.pack(side="left", padx=0)  # Pack the label on the left side with some padding

# Create a non-editable Text widget
num_conversations_widget = tk.Text(frame, height=1, width=5)  # Set width to 20 for better appearance
num_conversations_widget.insert(tk.END, "")  # Insert some default text
#num_conversations_widget.config(state=tk.DISABLED)  # Make the Text widget non-editable
num_conversations_widget.pack(side="right", fill="x", padx=10)  # Pack it to the right side with horizontal fill


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
