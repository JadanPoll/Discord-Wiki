from gensim.corpora import Dictionary
from gensim.models import TfidfModel
from gensim.downloader import load

# Load a sample corpus (e.g., 'text8')
corpus = load('text8')  # 'text8' is a large corpus for general language modeling

# 'corpus' is already a list of words, no need to split
corpus_data = corpus  # Use corpus directly as it is already tokenized into words

# Build a dictionary and corpus in Gensim format
dictionary = Dictionary(corpus_data)
corpus_gensim = [dictionary.doc2bow(doc) for doc in corpus_data]

# Train the TF-IDF model
tfidf_model = TfidfModel(corpus_gensim)

def get_tfidf_score(word):
    """
    Given a word, this function returns the TF-IDF score for that word
    across all documents in the 'text8' corpus (or other loaded corpus).
    """
    # Check if the word exists in the dictionary
    word_id = dictionary.token2id.get(word)
    
    if word_id is not None:
        # Get TF-IDF scores for the word across the corpus
        tfidf_scores = {doc_id: score for doc_id, score in tfidf_model[[(word_id, 1)]]}
        return tfidf_scores
    else:
        # If the word is not in the dictionary, return a message
        return f"'{word}' not found in the corpus."

# Function to get TF-IDF scores for a range of words
def get_tfidf_for_multiple_words(words):
    """
    Given a list of words, this function computes the TF-IDF scores for each word
    in the list across all documents in the corpus.
    """
    tfidf_results = {}
    for word in words:
        tfidf_results[word] = get_tfidf_score(word)
    return tfidf_results

# Example usage for a range of words
words_to_check = ["intelligence", "data", "computer", "science", "language"]
tfidf_scores_for_words = get_tfidf_for_multiple_words(words_to_check)

# Print the results
for word, scores in tfidf_scores_for_words.items():
    print(f"TF-IDF scores for '{word}': {scores}")
