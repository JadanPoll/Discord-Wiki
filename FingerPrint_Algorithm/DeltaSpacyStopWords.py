import spacy

# Load SpaCy's small English model
nlp = spacy.load("en_core_web_sm")

# Access the stopwords list
stopwords = nlp.Defaults.stop_words

# Print a subset of the stopwords
print(stopwords)
