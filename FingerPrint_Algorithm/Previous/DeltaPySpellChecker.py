from spellchecker import SpellChecker

# Create a SpellChecker instance
spell = SpellChecker()

# Input text
text = "I have a speling eror in this sentnce."

# Tokenize and correct each word
words = text.split()
corrected_words = [spell.correction(word) for word in words]

# Join the corrected words back into a sentence
corrected_text = " ".join(corrected_words)
print(corrected_text)
