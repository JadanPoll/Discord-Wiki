import re
import nltk
from nltk.corpus import brown
from nltk.corpus import wordnet
import time
# Download the NLTK data needed for this example
nltk.download('brown')
nltk.download('wordnet')
nltk.download('averaged_perceptron_tagger')

def get_pos_tags(words):
    # Tokenize the words into a list
    tokens = words

    # Get the POS tags for the tokens
    pos_tags = nltk.pos_tag(tokens)

    # Create a dictionary with the words as keys and their corresponding POS tags as values
    pos_tags_dict = {word: tag for word, tag in pos_tags}

    return pos_tags_dict

def is_noun(word, pos_tags_dict):
    # Check if the word is in the dictionary
    if word in pos_tags_dict:
        # Check if the POS tag for the word is 'NN' (noun)
        return pos_tags_dict[word] in ["NN", "NNP", "NNS", "NNPS"]
    else:
        return False

nouns = []
for synset in wordnet.all_synsets('n'):
    # Iterate over all lemmas in the synset
    for lemma in synset.lemmas():
        # Add the lemma name to the list of nouns
        nouns.append(lemma.name())
fdist = nltk.FreqDist(nouns).most_common(1000)
common_nouns = []
for element in fdist:
    common_nouns.append(element[0])

def extract_nouns(word_list, common_nouns):
    words = []
    tags = get_pos_tags(word_list)
    for word in word_list:
        if is_noun(word.lower(), tags): 
            if not (word.lower() in common_nouns):
                words.append(word)
    return words

def parse_multiline_messages(filename):
    messages = []
    current_name = None
    current_message = []
    with open(filename, 'r', encoding = "utf-8", errors = "ignore") as file:
        for line in file:
            line = line.strip()
            if len(line.split()) > 0:
                if line.split()[0][-1] == ":":
                    current_name = line.split(" ")[0][:-1]
                    current_message += re.sub(r'[^\w\s]', '', line).split()[1:]
                    messages.append([current_name, current_message, extract_nouns(current_message, common_nouns)])
                    current_message = []
                    current_name = None
            else:
                messages[-1][1] += re.sub(r'[^\w\s]', '', line).split()   
                messages[-1][2] += extract_nouns(re.sub(r'[^\w\s]', '', line).split(), 10)
    return messages

# Example usage
filename = "discord_messages.txt"
init_time = time.time()
messages = parse_multiline_messages(filename)
final_time = time.time()
print('\n'*10)
print("Time taken: ", final_time - init_time)
print('\n'*10)
for message in messages:
    pass
    #print(message)
# print(messages[10])