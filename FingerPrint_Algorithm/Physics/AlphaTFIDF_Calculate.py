import os
import json
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

# Function to load message content from each JSON file
def load_messages_from_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
        # Collect all messages in the "messages" array with content
        return " ".join([msg["content"] for msg in data.get("messages", []) if "content" in msg])

# Set paths and file list
file_list = [
    r'C:\Users\24namankwah\Documents\DExport\MINECRAFT - Minecraft - minecraft🎂 [752025169048109067].json',
    r'C:\Users\24namankwah\Documents\DExport\Study Together - 💭 Community - general [595999872222756888] (after 2024-11-01).json'
]
output_folder_path = r'./Physics'
os.makedirs(output_folder_path, exist_ok=True)  # Ensure output folder exists

# Initialize TfidfVectorizer
vectorizer = TfidfVectorizer()

# Variables for tracking scores and common words
overall_dict = {}
common_words = None  # This will track common words across all documents
total_corpus = ""

# Process each file in the file list
for file_path in file_list:
    print(f"In {file_path}")
    # Load messages for the current JSON file
    corpus = load_messages_from_json(file_path)
    words_length = len(corpus)
    total_corpus += " " + corpus

    # Compute TF-IDF for this single document
    tfidf_matrix = vectorizer.fit_transform([corpus])
    words = vectorizer.get_feature_names_out()
    
    # Sum TF-IDF scores across all terms in this document
    tfidf_dict = {word: tfidf_matrix[0, i] for i, word in enumerate(words)}
    
    # Normalize each score by the total words in the document
    tfidf_dict = {word: score / words_length for word, score in tfidf_dict.items()}
    
    # Update the set of common words
    if common_words is None:
        common_words = set(tfidf_dict.keys())
    else:
        common_words.intersection_update(tfidf_dict.keys())

    # Update the overall dictionary with normalized scores for words in the current document
    for word, score in tfidf_dict.items():
        if word in common_words:  # Only update overall_dict with common words
            if word in overall_dict:
                overall_dict[word] += score
            else:
                overall_dict[word] = score

    # Sort and save individual normalized TF-IDF scores for the file
    sorted_tfidf_dict = dict(sorted(tfidf_dict.items(), key=lambda item: item[1], reverse=True))
    individual_output_path = os.path.join(output_folder_path, os.path.basename(file_path).replace('.json', '_tfidf.json'))
    with open(individual_output_path, 'w', encoding='utf-8') as json_file:
        json.dump(sorted_tfidf_dict, json_file, indent=4)
        print(f"Saved {individual_output_path}")

# Compute TF-IDF on the total corpus using only common words
#vectorizer = TfidfVectorizer(vocabulary=common_words)
vectorizer = TfidfVectorizer() #Both
tfidf_matrix = vectorizer.fit_transform([total_corpus])
words = vectorizer.get_feature_names_out()

# Sum TF-IDF scores across all terms in the total corpus
overall_tfidf_dict = {word: tfidf_matrix[0, i] for i, word in enumerate(words)}

# Normalize each score by the total words in the total corpus
overall_tfidf_dict = {word: score / len(total_corpus) for word, score in overall_tfidf_dict.items()}

# Sort and save overall TF-IDF scores in the Physics folder
sorted_overall_dict = dict(sorted(overall_tfidf_dict.items(), key=lambda item: item[1], reverse=True))
overall_output_path = os.path.join(output_folder_path, 'both_tfidf_scores.json')
with open(overall_output_path, 'w', encoding='utf-8') as json_file:
    json.dump(sorted_overall_dict, json_file, indent=4)

print("TF-IDF scores have been calculated, normalized, sorted, and stored for each file individually and in 'Physics/tfidf_scores.json'.")
