import tkinter as tk
from tkinter import scrolledtext
import json
import random
from nltk.stem import PorterStemmer
from rapidfuzz import fuzz

#Create Hierachal dictionary

# Initialize stemmer and load stopwords
word_stemmer = PorterStemmer()
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

# Load and parse Discord message data
with open('./CEMU_discord_messages.json', encoding="utf-8") as discord_messages_file:
    discord_message_data = json.load(discord_messages_file)

import string
from spellchecker import SpellChecker
import time
# Initialize the spell checker
spell = SpellChecker()




# Function to preprocess message text: removes stopwords, strips punctuation, and applies optional stemming
def preprocess_message_text(message_text, apply_stemming=True):
    start = time.time()

    # Remove punctuation from the message text
    message_text = message_text.translate(str.maketrans('', '', string.punctuation))

    # Split the message into words
    words = message_text.split()

    # Correct spelling for each word (if implemented) and filter out None values
    corrected_words = [word for word in words]

    # Remove stopwords
    words_without_stopwords = [word for word in corrected_words if word.lower() not in loaded_stopwords]
    
    print("Processing time:", time.time() - start)
    
    # Apply stemming if needed
    return [word_stemmer.stem(word) for word in words_without_stopwords] if apply_stemming else words_without_stopwords


# Group messages by each author to form conversation blocks
#What it actually does it  A2 A1 A1  A1 A3. Then message will be A2 -> A1 together -> A3

def group_messages_by_author_message_block(message_data):
    conversation_blocks = []
    current_author = None
    author_messages = []

    for message_entry in message_data:
        if "content" in message_entry and "author" in message_entry and "username" in message_entry["author"]:
            author_name = message_entry["author"]["username"]
            if author_name == current_author:
                author_messages.append(message_entry["content"])
            else:
                if author_messages:
                    conversation_blocks.append("\n".join(author_messages))
                current_author = author_name
                author_messages = [message_entry["content"]]
    if author_messages:
        conversation_blocks.append("\n".join(author_messages))

    return conversation_blocks

# Load and preprocess conversation blocks
conversation_blocks = group_messages_by_author_message_block(discord_message_data)
processed_conversation_blocks = [" ".join(preprocess_message_text(block)) for block in conversation_blocks]


# Function to search for a query within a message block using word-by-word processing, optional stemming, and fuzzy matching
def find_query_in_message_block(query_list, message_block, apply_stemming=True, fuzz_threshold=80):
    # Split query_text into individual words
    query_words = query_list
    

    # Initialize match results
    match_results = {
        "exact_matches": [],
        "fuzzy_matches": []
    }
    #print(query_words)
    # Perform exact match search word-by-word
    message_block_word_list = message_block.split()
    for query_word in query_words:
        exact_word_matches = [text for text in message_block_word_list if text == query_word] if message_block else []
        if exact_word_matches:
            match_results["exact_matches"].extend(exact_word_matches)
            return True
        else:
            pass
            #return False
            # Fuzzy match only if no exact matches are found
            fuzzy_word_matches = [text for text in message_block if fuzz.partial_ratio(query_word, text) >= fuzz_threshold]
            #match_results["fuzzy_matches"].extend(fuzzy_word_matches)
    
    return match_results["exact_matches"] + match_results["fuzzy_matches"]

# Build a recursive context chain of related messages around a central message
def construct_context_chain(word_list, search_radius, message_index, visited_indices, context_chain, recursion_level=1):
    start_index = max(0, message_index - search_radius)
    end_index = min(len(processed_conversation_blocks), message_index + search_radius + 1)
    
    for i in range(start_index, end_index):
        if i not in visited_indices:
            if find_query_in_message_block(word_list, processed_conversation_blocks[i]):
                visited_indices.add(i)
                context_chain.append((i, conversation_blocks[i], recursion_level))
                construct_context_chain(word_list+processed_conversation_blocks[i].split(), max(search_radius // 2, 1), i, visited_indices, context_chain, recursion_level + 1)

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

        construct_context_chain(random_block_words, search_radius, random_block_index, visited_block_indices, context_chain)
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

# Initialize Tkinter GUI
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("800x600")

tk.Label(app_main_window, text="Enter context chain search radius:").pack(pady=5)
context_radius_input = tk.Entry(app_main_window)
context_radius_input.insert(0, "50")
context_radius_input.pack(pady=5)

tk.Label(app_main_window, text="Generate a context chain from random Discord messages", font=("Arial", 14)).pack(pady=10)
tk.Button(app_main_window, text="Generate Context Chain", command=generate_and_display_random_context_chain, font=("Arial", 12), bg="#4CAF50", fg="white").pack(pady=10)


# Create a ScrolledText widget that will resize with the window
output_text_display = scrolledtext.ScrolledText(app_main_window, wrap=tk.WORD, font=("Arial", 10))
output_text_display.pack(padx=10, pady=10, expand=True, fill='both')  # Enable resizing with the window


output_text_display.tag_configure("highlight_selected", background="#DDEEFF", foreground="#003366")
output_text_display.tag_configure("highlight_processed", background="#E0FFE0", foreground="#006600")

app_main_window.mainloop()
