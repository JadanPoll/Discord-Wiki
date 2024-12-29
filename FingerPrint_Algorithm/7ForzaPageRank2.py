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
import spacy
from ModifiedNotebook import Notebook
from nltk.stem import PorterStemmer
text_rank = TextRank4Keyword()  # Initialize TextRank globally
text_rank.analyze("Removing cold start", window=5, lower=True) #Here to reduce cold start



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

    filtered_words = filter_words_by_pos(optimal_keywords, pos_to_keep)

    return filtered_words



FILEPATH = None
GLOSSARY_FILEPATH = None
SUMMARIES_FILEPATH = None
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

punctuations=r"""",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“`"""

print(punctuations)

# Function to preprocess message text: removes stopwords, strips punctuation, and applies stemming
def preprocess_message_text(message_text):

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
    conversation_blocks = []  # Will store original blocks
    processed_conversation_blocks = []  # Will store preprocessed blocks
    current_author = None
    author_messages = []

    #Handle yet another data format
    if isinstance(message_data, dict) and "messages" in message_data:
        message_data = message_data["messages"]

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



# Load and preprocess conversation blocks in one step
#conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)

def load_multi_conversations():
    global conversation_blocks
    global processed_conversation_blocks
    global glossary
    global summary_array_html_results
    global FILEPATHS
    global GLOSSARY_FILEPATH
    global SUMMARIES_FILEPATH
    # Initialize or clear shared variables
    summary_array_html_results = {}
    conversation_blocks = []
    processed_conversation_blocks = []
    
    # Open the file dialog for selecting multiple files
    FILEPATHS = filedialog.askopenfilenames(
        title="Select Discord Messages Files",
        filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
    )
    
    # Check if files were selected
    if not FILEPATHS:
        print("No files selected.")
        return
    
    output_text_display.delete('1.0', tk.END)  # Clear the text display
    
    for FILEPATH in FILEPATHS:
        # Display the selected file name
        # Define corresponding glossary and summary file paths
        GLOSSARY_FILEPATH = f"GLOSSARY/GLOSSARY_{os.path.basename(FILEPATH)}"
        SUMMARIES_FILEPATH = f"SUMMARY/SUMMARY_{os.path.basename(FILEPATH)}"
        
        # Load and process the selected file
        try:
            with open(FILEPATH, encoding="utf-8") as discord_messages_file:
                output_text_display.insert(tk.END, f"Loaded {os.path.basename(FILEPATH)}!\n")

                discord_message_data = json.load(discord_messages_file)
            
            # Load and preprocess conversation blocks for this file
            new_conversation_blocks, new_processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)
            
            # Merge with existing conversation blocks
            conversation_blocks.extend(new_conversation_blocks)
            processed_conversation_blocks.extend(new_processed_conversation_blocks)
            
            # Try to load the glossary for this file
            try:
                load_multi_glossary_from_file()
                load_multi_summary_from_file()
            except FileNotFoundError:
                print(f"Glossary not found for {os.path.basename(FILEPATH)}.")
            
        except Exception as e:
            print(f"Error processing file {os.path.basename(FILEPATH)}: {e}")
    
    update_clustering(glossary_tree, 0.0, glossary)
    try:
        def load():
            if app_main_window.Discord_Summary_Window_Created:
                app_main_window.Discord_Summary_Window_Created.event_generate("<Destroy>")
                app_main_window.Discord_Summary_Window_Created = None
            display_summary_popup()
        app_main_window.after(500, load)
    except Exception as e:
        print(f"Error loading summaries: {e}")


def load_multi_glossary_from_file():
    global glossary  # Use the global glossary variable

    try:
        with open(GLOSSARY_FILEPATH, 'r', encoding='utf-8') as file:
            file_glossary = json.load(file)  # Load JSON data from the glossary file
            output_text_display.insert(tk.END, f"Loaded {os.path.basename(GLOSSARY_FILEPATH)}!\n")
            
            # Process the glossary data
            for key, value in file_glossary.items():
                if key in glossary:
                    # If the existing value is a list of lists, append the new list
                    glossary[key].extend(value)
                else:
                    glossary[key] = value
            
            print("Glossary updated successfully!")

    except FileNotFoundError:
        print(f"Error: The file '{GLOSSARY_FILEPATH}' was not found.")
    except json.JSONDecodeError as e:
        print(f"Error: Failed to decode JSON from '{GLOSSARY_FILEPATH}': {e}")
    except Exception as e:
        print(f"Error: An unexpected error occurred while loading '{GLOSSARY_FILEPATH}': {e}")

def load_multi_summary_from_file():
    global summary_array_html_results  # Use the global variable

    try:
        with open(SUMMARIES_FILEPATH, 'r', encoding='utf-8') as file:
            # Load JSON data
            curr_summary_array_html_results = json.load(file)
            print("Summaries loaded successfully!")
            output_text_display.insert(tk.END, f"Loaded {os.path.basename(SUMMARIES_FILEPATH)}!\n")

            # Process each key-value pair from the current summary
            for key, value in curr_summary_array_html_results.items():
                base_key = key.split("_")[0]  # Extract the base part of the key (e.g., "rtx")

                # Check if the base key already exists in the summary
                if key in summary_array_html_results:
                    # Find the next available key number
                    current_keys = [k for k in summary_array_html_results if k.startswith(base_key)]
                    next_index = max([int(k.split("_")[1]) for k in current_keys], default=-1) + 1
                    new_key = f"{base_key}_{next_index}"
                    summary_array_html_results[new_key] = value
                else:
                    # If no existing key, simply add the new key-value pair
                    summary_array_html_results[key] = value

    except FileNotFoundError:
        print(f"Error: The file '{SUMMARIES_FILEPATH}' was not found.")
    except json.JSONDecodeError as e:
        print(f"Error: Failed to decode JSON from '{SUMMARIES_FILEPATH}': {e}")
    except Exception as e:
        print(f"Error: An unexpected error occurred while loading '{SUMMARIES_FILEPATH}': {e}")

def load_conversation():
    global conversation_blocks
    global processed_conversation_blocks
    global FILEPATH
    global GLOSSARY_FILEPATH
    global SUMMARIES_FILEPATH
    global glossary
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
                if app_main_window.Discord_Summary_Window_Created:
                    app_main_window.Discord_Summary_Window_Created.event_generate("<Destroy>")
                    app_main_window.Discord_Summary_Window_Created = None
                display_summary_popup()
            app_main_window.after(500,load)

        return
    except:
        glossary = {}
        update_clustering(glossary_tree, 0.0, glossary)
        pass
    
porter_stemmer = PorterStemmer()
porter_stemmer.stem("Heatup")
def Null(word):
    return word
porter_stemmer.stem = Null


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
        block_words = set(processed_conversation_blocks[block_index].split())
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
            output_text_display.insert(tk.END, f"DMessage {message_id}:{message}\n{'-' * 50}\n")





def Focus_DText(dmessage):
    # Extract numbers from the message string (e.g., "capture starting DMessage and an nnumbers after eg:DMessage 198,200 or DMessage 198,DMessage 200")
    numbers = set(int(num) for num in re.findall(r'\d+', dmessage))  # Use a set for fast lookup
    print(numbers)
    if len(numbers)==0:
        return
    # Create a list to hold the messages for display
    output_text_display.delete('1.0', tk.END)  # Clear previous content
    
    # Initialize a set to track already displayed message_ids (to avoid duplicates)
    displayed_message_ids = set()

    # Collect the 5 previous, current, and 5 next messages for each number
    for number in numbers:
        start_index = max(0, number - 5)
        end_index = min(len(conversation_blocks), number + 6)  # end_index should be number + 5 + 1

        # Extract the messages and display them with possible highlighting
        for idx in range(start_index, end_index):

            displayed_message_ids.add(idx)
    print(displayed_message_ids)
    displayed_message_ids = sorted(displayed_message_ids)
    for idx in displayed_message_ids:    
        message = conversation_blocks[idx]
        message_id = idx  # Assuming the index in conversation_blocks corresponds to the message_id

        # Insert the message text
        if message_id in numbers:
            output_text_display.insert(tk.END, f"DMessage {message_id}: {message}\n{'-' * 50}\n", "highlight_selected")
        else:
            output_text_display.insert(tk.END, f"DMessage {message_id}: {message}\n{'-' * 50}\n")



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
                "Don't include in summary information that doesn't relate to the topic specified in: Topic <Topic_Name>. Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response Eg:(DMessage 10) . If possible break it into subheadings:" + context_chain_text,
                learn=True
            )
        else:
            print(f"Found in results {search}")
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {e}")




# Function to wrap all (DMessage) content with the hoverable class
def wrap_all_dmessages_with_hoverable(content):
    # Use regex to find all occurrences of (DMessage...) in the content
    dmessage_pattern = r"\(DMessage.*?\)"
    
    # Function to wrap each DMessage match with the hoverable class
    def wrap_match(match):
        return f'<span class="hoverable" data-tooltip="DMessage Tooltip">{match.group(0)}</span>'

    # Apply the wrapping to all matches in the content
    modified_content = re.sub(dmessage_pattern, wrap_match, content)

    return modified_content


prev_key = None
# Function to display the summary in a popup window
def display_summary_popup(page_name = None,page_content = None):




    global notebook

    def go_to_page(direction):
        try:

            if not hasattr(notebook, "summary_index") or notebook.summary_index is None:
                return

            selected_text, hidden_index = notebook.summary_index.split('_')
            hidden_index = int(hidden_index)
            selected_frame = notebook.summary_frame
            if not summary_array_html_results or direction == 0:
                return

            # Calculate the next page index, ensuring it's within bounds


            keys = [key for key in summary_array_html_results if key.startswith(selected_text)]

            next_page_index =  min(max(0,hidden_index+direction),len(keys)-1)

            new_html_result = summary_array_html_results.get(f"{keys[next_page_index]}")  # Ensure it's valid
            
            if not new_html_result:
                raise KeyError(f"HTML result not found for {selected_text}_{next_page_index}")

            new_html_result = wrap_all_dmessages_with_hoverable(new_html_result)

            new_html_result = generator.generate_and_display_html("", new_html_result, theme="ocean")
            
            selected_frame.load_html(new_html_result)  # Update the HtmlFrame with the new HTML content

            # Update the hidden_index for the HtmlFrame (so we can track the current page)
            selected_frame.hidden_index = next_page_index

            # Update the title or popup based on the page's content
            selected_page = f"{selected_text}_{next_page_index}"  # Using the selected tab name for the page title
            notebook.summary_index = selected_page
            page_parts = selected_page.split('_')
            if len(page_parts) >= 2:
                summary_popup.title(f"Summary: {page_parts[0].upper()} Conversation: {page_parts[1]}")

        except (ValueError, KeyError, IndexError) as e:
            print(f"Error: {e}")
            messagebox.showerror("Invalid Input", "Please select a valid page.")




    def doubleclick(frame):
        # Assuming `get_currently_hovered_node_text` is a function or method
        hovered_text = frame.get_currently_hovered_node_text().strip()
        if not hovered_text.startswith("(") and not hovered_text.endswith(")") and "DMessage" not in hovered_text:
            return
        print(hovered_text)
        Focus_DText(hovered_text.replace(' ',''))



    if app_main_window.Discord_Summary_Window_Created:
        app_main_window.Discord_Summary_Window_Created.lift()
        print("AHere")
        # Check if the page already exists in the notebook
        for tab in notebook.tabs():
            print(notebook.tab(tab, "text"),page_name)
            if notebook.tab(tab, "text") == page_name:
                return  # Page already exists, no need to add

        print("BHere",page_name)
        # Create a new HtmlFrame for the page
        summary_display = HtmlFrame(notebook, horizontal_scrollbar="auto")
        summary_display.bind("<Button-1>", lambda event, frame=summary_display:  doubleclick(frame),add=True)
        
        page_content = wrap_all_dmessages_with_hoverable(page_content)
        page_content = generator.generate_and_display_html("", page_content, theme="ocean")
        summary_display.load_html(page_content)
        summary_display.hidden_index = 0
        # Add the new page to the notebook
        notebook.add(summary_display, text=page_name)

    else:
        summary_popup = tk.Toplevel(app_main_window)
        summary_popup.title(f"Summary: {glossary_tree.item(glossary_tree.selection())['text'].upper()} Conversation: {conversation_spinbox.get()}")
        summary_popup.geometry("900x600")
        summary_popup.bind("<Control-s>", lambda event: save_summary())

        # Define the function to execute when the popup window is closed
        def on_popup_close():
            app_main_window.Discord_Summary_Window_Created.destroy()
            app_main_window.Discord_Summary_Window_Created = None

        summary_popup.protocol("WM_DELETE_WINDOW", on_popup_close)

        # Bind left and right arrow keys to change the page
        def on_left_arrow(event):

            go_to_page(-1)

        def on_right_arrow(event):

            go_to_page(1)

        summary_popup.bind("<Left>", on_left_arrow)
        summary_popup.bind("<Right>", on_right_arrow)

        # Create a Notebook widget (for tabs)
        notebook = Notebook(summary_popup)
        notebook.pack(fill="both", expand=True, padx=10, pady=10)

        notebook.bind("<<NotebookTabChanged>>", lambda event: ontabchange(event))

        def ontabchange(event):
            # Get the ID of the currently selected tab
            selected_tab = notebook.notebook.select()
            
            # Get the text (name) of the currently selected tab
            selected_text = notebook.notebook.tab(selected_tab, "text")

            selected_frame = notebook.pages[notebook.notebook.index(selected_tab)]
            # You can store the index of the currently selected tab (assuming you want to store the hidden index)
            selected_index = selected_frame.hidden_index  # This will give you the index of the selected tab
            notebook.summary_index = f"{selected_text}_{selected_index}"
            notebook.summary_frame = notebook.pages[notebook.notebook.index(selected_tab)]

            # Update the window title with the selected tab's text and hidden index
            summary_popup.title(f"Summary: {selected_text.upper()} Conversation: {selected_index}")


        # Create a set to track the pages we've already seen (split by '_')
        seen_pages = set()
        for page, summaries in summary_array_html_results.items():

            page_name = page.split('_')[0]

            # If the page has not been seen yet, create a new tab
            if page_name not in seen_pages:
                seen_pages.add(page_name)  # Mark this page as seen

                #tab_frame = tk.Frame(notebook)

                summary_display = HtmlFrame(notebook, horizontal_scrollbar="auto")
                summary_display.bind("<Button-1>", lambda event, frame=summary_display:  doubleclick(frame),add=True)

                summary_display.hidden_index = 0

                summaries = wrap_all_dmessages_with_hoverable(summaries)
                summaries = generator.generate_and_display_html("", summaries, theme="ocean")
                
                summary_display.load_html(summaries)

                notebook.add(summary_display, text=page_name)  # Use page_name as the tab text




        # Function to scroll the HtmlFrame up
        def scroll_up(event):

            selected_tab = notebook.notebook.select()  # Get the ID of the currently selected tab
            selected_frame = notebook.pages[notebook.notebook.index(selected_tab)]
            if selected_frame:  # If a tab is selected

                html_frame = selected_frame  # The HtmlFrame is the first widget in the frame
                html_frame.yview_scroll(-1, "units")  # Scroll up by one unit

        # Function to scroll the HtmlFrame down
        def scroll_down(event):
            selected_tab = notebook.notebook.select()  # Get the ID of the currently selected tab
            selected_frame = notebook.pages[notebook.notebook.index(selected_tab)]
            if selected_frame:  # If a tab is selected

                html_frame = selected_frame  # The HtmlFrame is the first widget in the frame
                html_frame.yview_scroll(1, "units")  # Scroll up by one unit

        # Bind the Up and Down arrow keys to scroll the HtmlFrame
        summary_popup.bind("<Down>", scroll_down)
        summary_popup.bind("<Up>", scroll_up)



        #summary_display.pack(padx=10, pady=10, fill="both", expand=True)

        app_main_window.Discord_Summary_Window_Created=summary_popup

        #go_to_page(0)


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
            app_main_window.after(0, display_summary_popup,selected_item, html_result)

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
        if current_page < default_settings["num_pages_summary"] + handle_incoming_summary_response.initial-1 and current_page < max_topic_pages - 1:
            app_main_window.after(0, next_page)
        else:

            del handle_incoming_summary_response.initial


            upper_limit = int(conversation_spinbox["to"])
            conversation_spinbox.delete(0, "end")  # Clear the current value
            conversation_spinbox.insert(0, str(min(current_page+1,upper_limit)))  # Insert the new value

    except Exception as e:
        messagebox.showerror("Error", f"An unexpected error occurred: {str(e)}")





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

summarize_menu = tk.Menu(menu_bar, tearoff=0)
summarize_menu.add_command(label="Summarize", command=summarize_context_chain, accelerator="Ctrl+G")

file_menu = tk.Menu(menu_bar, tearoff=0)
file_menu.add_command(label="Load Conversation", command=load_conversation)
file_menu.add_command(label="Load Multi Conversations", command=load_multi_conversations)
file_menu.add_command(label="Save Glossary", command=save_glossary, accelerator="Ctrl+S")
file_menu.add_command(label="Save Conversation Summaries", command=save_summary, accelerator="Ctrl+Shift+S")
file_menu.add_separator()
file_menu.add_command(label="Exit", command=app_main_window.quit, accelerator="Ctrl+Q")


# Add the Settings menu
settings_menu = tk.Menu(menu_bar, tearoff=0)
settings_menu.add_command(label="General", command=open_settings_dialog)  # Open the dialog box when clicked


menu_bar.add_cascade(label="File", menu=file_menu)
menu_bar.add_cascade(label="Generate", menu=generate_menu)
menu_bar.add_cascade(label="Summarize", menu=summarize_menu)

menu_bar.add_cascade(label="Settings",menu=settings_menu)
app_main_window.config(menu=menu_bar)
app_main_window.bind('<Control-l>', lambda event: generate_and_display_all_random_context_chain())
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

        num_conversations_widget.delete('1.0', tk.END)  # Clear all text
        num_conversations_widget.insert(tk.END, str(gl_len+1))  # Insert the selected glossary entry


        display_selected_glossary(item_name,int(conversation_spinbox.get()))  # Call the function with the selected item name

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
