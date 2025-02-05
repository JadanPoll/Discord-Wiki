from pinecone import Pinecone, ServerlessSpec
import json

pc = Pinecone(api_key="pcsk_68RpQp_U1uWtNsxDGA7sh6tEVtbQz1kDPprmSogeCr74nRWtBNCNuUkyQQQZnADxtC6fw")

index_name = "rag-test"

if not pc.has_index(index_name):
    pc.create_index(
        name=index_name,
        dimension=1024, # Replace with your model dimensions
        metric="cosine", # Replace with your model metric
        spec=ServerlessSpec(
            cloud="aws",
            region="us-east-1"
        ) 
    )

import getpass
import platform
user_platform = platform.uname().system
username = getpass.getuser()
root = ""
if user_platform == "Windows":
    root = "C:/Users/"
else:
    root = "/Users/"

import re
import html
import time
import os
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from tkinterweb import HtmlFrame
from textrank4zh import TextRank4Keyword
import json
from kneed import KneeLocator
from GroupTheoryAPI2 import *
import threading
from tkinter import filedialog
from Special import HTMLStyling
from ModifiedNotebook import Notebook
from nltk.stem import PorterStemmer
from textblob import TextBlob
text_rank = TextRank4Keyword()  # Initialize TextRank globally
#text_rank.analyze("Removing cold start", window=5, lower=True) #Here to reduce cold start

# Load the spaCy model for English

from textblob import TextBlob

def filter_words_by_pos(words, pos_tags):
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
    filtered_words = filter_words_by_pos(optimal_keywords, pos_to_keep)
    print(filtered_words)
    return filtered_words



FILEPATH = None
GLOSSARY_FILEPATH = None
SUMMARIES_FILEPATH = None
with open(root+username+'/Discord-Wiki/FingerPrint_Algorithm/discord-stopword-en.json', encoding='utf-8') as stopword_file:
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
file_path = root+username+"/Downloads/SigPWNY_discord_messages.json"
with open(file_path, encoding='utf-8') as discord_messages_file:
    discord_message_data = json.load(discord_messages_file)
conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)

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
    #processing_thread = threading.Thread(target=generate_glossary)
    #processing_thread.daemon = True  # Daemon thread will exit when the main program exits
    #processing_thread.start()

    print(f"Number of Chains:{i}")

    #since the tree is global, we can return it
    return conversation_topic_tree


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
    search_radius = 50
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
        

#tree of chains made

tree = generate_and_display_all_random_context_chain()
print(len(tree))
print(type(tree))

print(len(tree['1211']))
import random
checker = False
#random key in the tree
while checker == False:
    ind = random.randint(1, 2960)
    if str(ind) not in tree.keys():
        ind = random.randint(1, 2960)
    else:
        checker = True
ind = 1435
print("Key: " + str(ind))

#create message chain from chain that corresponds with the key
message_chain = ""
for msg in tree[str(ind)]:
    message = msg["message"] + " (Message ID: " + str(msg["message_id"]) + "). "

    message_chain += message

print(message_chain)

#deepseek fun!

from openai import OpenAI

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key="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",
)

completion = client.chat.completions.create(
  extra_headers={
    "HTTP-Referer": "<YOUR_SITE_URL>", # Optional. Site URL for rankings on openrouter.ai.
    "X-Title": "<YOUR_SITE_NAME>", # Optional. Site title for rankings on openrouter.ai.
  },
  model="deepseek/deepseek-r1:free",
  messages=[
    {
      "role": "user",
      "content": "Don't include in summary information that doesn't relate to the topic specified in the conversation chain. Summarize this combining abstractive and high-quality extractive. Don't miss any details in it. Reference specific messages in your response Eg:(DMessage 10) . If possible break it into subheadings:" + message_chain
    }
  ]
)
print(completion)