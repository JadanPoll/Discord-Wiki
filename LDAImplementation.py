import os
import re
import gensim
import pyLDAvis
print(pyLDAvis.__version__)
import pyLDAvis.gensim
import pickle
import string
from gensim.utils import simple_preprocess
import nltk
from nltk.corpus import stopwords
from pprint import pprint

#NOTE: Check Line 94 and 95 for path to the input/output files

# gets username from the OS
username = os.environ.get('USER')
print(username)

# Download the stopwords if not already done
nltk.download('stopwords')
stop_words = stopwords.words('english')

# Ensure the nltk word corpus is downloaded
nltk.download('words')
english_words = set(nltk.corpus.words.words())

def clean_text(line):
    # Remove username and colon at the beginning of each line
    cleaned = re.sub(r'^[^:]+: ', '', line)
    
    # Convert text to lowercase
    cleaned = cleaned.lower()
    
    # Remove URLs
    cleaned = re.sub(r'http\S+|www\S+|https\S+', '', cleaned)
    
    # Remove Discord mentions in format <@&123456789>
    cleaned = re.sub(r'<@&\d+>', '', cleaned)
    
    # Remove punctuation
    cleaned = cleaned.translate(str.maketrans('', '', string.punctuation))
    
    # Remove non-English words
    cleaned = ' '.join([word for word in cleaned.split() if word in english_words])
    
    return cleaned

# Clean the text in order for us in LDA
def process_file(input_path, output_path):
    with open(input_path, 'r') as file:
        lines = file.readlines()
    
    cleaned_lines = [clean_text(line) for line in lines if line.strip()]
    
    with open(output_path, 'w') as file:
        file.write("\n".join(cleaned_lines))

# Load data from the cleaned up text file
def load_data(input_path):
    with open(input_path, 'r') as file:
        lines = file.readlines()
    return [line.strip() for line in lines if line.strip()]

# Function to tokenize sentences
def sent_to_words(sentences):
    for sentence in sentences:
        # `deacc=True` removes punctuations
        yield(gensim.utils.simple_preprocess(str(sentence), deacc=True))

# Function to remove stopwords
def remove_stopwords(texts):
    return [[word for word in simple_preprocess(str(doc)) 
             if word not in stop_words] for doc in texts]

# Process data for LDA
def process_for_lda(input_path):
    # Load and clean the data
    data = load_data(input_path)
    
    # Tokenize the sentences into words
    data_words = list(sent_to_words(data))
    
    # Remove stopwords
    data_words = remove_stopwords(data_words)
    
    # Create dictionary and corpus for LDA
    dictionary = gensim.corpora.Dictionary(data_words)
    corpus = [dictionary.doc2bow(text) for text in data_words]
    
    return dictionary, corpus, data_words

# Paths to input and output files
input_path = '/Users/' + username + '/Discord-Wiki/TextExample.txt'
output_path = '/Users/' + username + '/Discord-Wiki/CleanTextExample.txt'

# Create a clean text file
process_file(input_path, output_path)

if __name__ == "__main__":
    # Process the text file
    dictionary, corpus, data_words = process_for_lda(output_path)

    # Number of topics
    num_topics = 50

    # Build LDA model
    lda_model = gensim.models.LdaMulticore(corpus=corpus,
                                        id2word=dictionary,
                                        num_topics=num_topics)

    # Path to save the LDA visualization data
    LDAvis_data_filepath = os.path.join('./results/ldavis_prepared_' + str(num_topics))

    # Prepare LDA visualization
    if not os.path.exists('./results'):
        os.makedirs('./results')

    if not os.path.isfile(LDAvis_data_filepath):  # Skip preparation if already prepared
        LDAvis_prepared = pyLDAvis.gensim.prepare(lda_model, corpus, dictionary)
        with open(LDAvis_data_filepath, 'wb') as f:
            pickle.dump(LDAvis_prepared, f)
    else:
        with open(LDAvis_data_filepath, 'rb') as f:
            LDAvis_prepared = pickle.load(f)

    # Save visualization as HTML
    pyLDAvis.save_html(LDAvis_prepared, './results/ldavis_prepared_' + str(num_topics) + '.html')
