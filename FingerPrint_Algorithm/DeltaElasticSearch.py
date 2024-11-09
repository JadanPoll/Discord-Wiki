from nltk.stem import PorterStemmer
from rapidfuzz import fuzz
import time

# Initialize stemmer only once to improve efficiency
stemmer = PorterStemmer()

def preprocess_corpus(corpus, use_stemming=True):
    """Preprocess the corpus by applying stemming if enabled."""
    if use_stemming:
        return {word: stemmer.stem(word) for word in corpus}
    return {word: word for word in corpus}  # No stemming if use_stemming is False

def search(query, corpus, stemmed_corpus=None, use_stemming=True, threshold=70):
    """
    Search for query in corpus with optional stemming and fuzzy matching.
    
    Parameters:
        query (str): The search term.
        corpus (list): The original list of words to search in.
        stemmed_corpus (dict): Preprocessed corpus with stems (optional).
        use_stemming (bool): Whether to use stemming.
        threshold (int): Fuzzy matching threshold (0-100).
    
    Returns:
        dict: Results with direct stem matches and fuzzy partial matches.
    """
    query_stemmed = stemmer.stem(query) if use_stemming else query
    matches = {}

    # Direct Stem Match
    matches["stems"] = [
        word for word, stem in stemmed_corpus.items()
        if stem == query_stemmed
    ] if stemmed_corpus else []

    # Fuzzy Match if no stem matches or to expand results
    if not matches["stems"]:
        matches["partials"] = [
            word for word in corpus
            if fuzz.partial_ratio(query, word) >= threshold
        ]
    if matches["stems"]:
        matches["stems_partials"] = [
            word for word in corpus
            if fuzz.partial_ratio(query, word) >= 90
        ]

    return matches

# Example Usage
def main():
    start_time = time.time()

    # Original corpus for searching
    corpus = ["monads", "monadic", "monoids", "monomial", "mono"]

    # Preprocess the corpus only once
    stemmed_corpus = preprocess_corpus(corpus, use_stemming=True)

    # Search query
    query = "monoids"
    results = search(query, corpus, stemmed_corpus=stemmed_corpus, use_stemming=True, threshold=70)

    # Output results and timing
    print(f"Time taken: {time.time() - start_time:.4f} seconds")
    print(f"Results for '{query}': {results}")

# Run the example
main()
