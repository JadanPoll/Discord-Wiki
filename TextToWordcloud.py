import re
import string
import nltk
from wordcloud import WordCloud

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

def process_file(input_path, output_path):
    with open(input_path, 'r') as file:
        lines = file.readlines()
    
    cleaned_lines = [clean_text(line) for line in lines if line.strip()]

    # Join the different processed titles together.
    long_string = ','.join(cleaned_lines)
    # Create a WordCloud object
    wordcloud = WordCloud(background_color="white", max_words=5000, contour_width=3, contour_color='steelblue')
    # Generate a word cloud
    wordcloud.generate(long_string)
    # Visualize the word cloud
    wordcloud.to_file("/Users/samarthsreenivas/Documents/Discord-Wiki/WordcloudExample.png")
    
    # with open(output_path, 'w') as file:
    #     file.write("\n".join(cleaned_lines))

# Paths to input and output files
input_path = '/Users/samarthsreenivas/Documents/Discord-Wiki/TextExample.txt'
output_path = '/Users/samarthsreenivas/Documents/Discord-Wiki/CleanTextExample.txt'

# Process the file
process_file(input_path, output_path)
