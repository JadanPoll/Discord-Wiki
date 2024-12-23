import spacy

# Load the spaCy model
nlp = spacy.load("en_core_web_sm")

# Example of a single word
word = "talk streaming haha meh In today's article, we're embarking on something unprecedented! We'll guide you step by step through the process of transforming an SSD equipped with QLC NANDs into an SLC SSD, significantly enhancing its durability and overall performance!"

# Process the word using spaCy
doc = nlp(word)

# Show the token's POS, lemma, and other features
for token in doc:
    print(f"Word: {token.text}, POS: {token.pos_}, Lemma: {token.lemma_}")
