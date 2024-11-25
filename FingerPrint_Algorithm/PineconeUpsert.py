from pinecone import Pinecone, ServerlessSpec
import json
from nltk.stem import PorterStemmer
import random
from tkinter import scrolledtext
from sklearn.feature_extraction.text import TfidfVectorizer
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModel

pc = Pinecone(api_key="")

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

file_path = '/Users/shubhan/Discord-Wiki/FingerPrint_Algorithm/DiscServers/ECE 120 Fall 2024 - exams - mt3 [1275789619954323534].json'
index = pc.Index(index_name)

# Initialize stemmer and load stopwords
word_stemmer = PorterStemmer()
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

import string
from spellchecker import SpellChecker
import time
# Initialize the spell checker
spell = SpellChecker()

punctuations=r"""",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“`"""

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

# Function to generate embeddings
def generate_embedding(text):
    embeddings = pc.inference.embed("multilingual-e5-large",
        inputs=text,
        parameters={
            "input_type": "query"
        }
    )  # Average over all tokens

    return embeddings

def load_messages_from_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = json.load(file)
        return content
        # Collect all messages in the "messages" array with content
        #return " ".join([msg.get("content", "") for msg in data if "content" in msg])
        # Generate embedding for the message content

data = load_messages_from_json(file_path)

# Load and preprocess conversation blocks in one step
conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(data)

for i, entry in enumerate(data):
    content = entry["content"]
    
    # Generate embedding for the message content
    content_embedding = generate_embedding(content)
    
    vectors = []
    for d, e in zip(data, content_embedding):
        vectors.append({
            "id": entry['id'],
            "values": e['values'],
            "metadata": {'text': entry['content']}
        })
    # Insert into Pinecone using the message id
    index.upsert(vectors=vectors, namespace="ECE 120 Fall 2024 exams")