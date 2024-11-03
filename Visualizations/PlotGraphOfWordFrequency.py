import json
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use the Agg backend for non-GUI rendering

import matplotlib.pyplot as plt
from flask import Flask, render_template, send_file, request, jsonify
import io
import os

app = Flask(__name__)

# Function to load JSON data from a file with utf-8 encoding
def load_data_from_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON from file: {file_path}")
        return None

# Extract total text lengths by user
def extract_word_frequency(data):
    word_frequency = {}
    for message in data:
        user_text = message.get('content', '')  # Get the message content

        if user_text:  # Only consider messages with valid text
            
            user_text_split = user_text.split()
            for word in user_text_split:
                if "https" not in word and "@" not in word:
                    word_length = len(word)
                    if word in word_frequency:
                        word_frequency[word] += word_length  # Accumulate length
                    else:
                        word_frequency[word] = word_length  # Initialize length

    return word_frequency

# Plot the text density by user
def plot_word_frequency(word_frequency):
    if not word_frequency:
        print("No data to plot.")
        return None  # Return None if there's no data to plot

    df = pd.Series(word_frequency).sort_values(ascending=False).head(100)  # Create a pandas Series and sort

    plt.figure(figsize=(24, 14))  # Larger figure size for better visibility
    df.plot(kind='bar', color='skyblue', width=0.7, title="Word Frequency", edgecolor='black')
    plt.xlabel("Word", fontsize=8)
    plt.ylabel("Frequency", fontsize=14)
    plt.xticks(rotation=45, ha='right', fontsize=12)
    plt.yticks(fontsize=12)
    plt.grid(axis='y', linestyle='--', alpha=0.7)  # Add dashed gridlines only on the y-axis
    plt.tight_layout()  # Adjust layout for better fit

    # Save plot to a BytesIO object
    img = io.BytesIO()
    plt.savefig(img, format='png')  # Save plot as PNG in BytesIO
    img.seek(0)  # Seek to the start of the BytesIO object
    plt.close()  # Close the plot
    return img

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/plot', methods=['GET'])
def plot():
    file_path = '/Users/samarthsreenivas/Documents/Discord-Wiki/Visualizations/discord_channel.json'  # Hardcoded for testing
    if not os.path.isfile(file_path):
        return jsonify({"error": "Invalid file path"}), 400

    data = load_data_from_file(file_path)  # Load data from the provided file path
    if data is None:
        return jsonify({"error": "Error loading JSON data"}), 400

    word_frequency = extract_word_frequency(data)
    img = plot_word_frequency(word_frequency)
    
    if img is None:
        return jsonify({"error": "Error generating plot"}), 400  # Return an error if img is None
    
    return send_file(img, mimetype='image/png')  # Send the PNG image as a response


if __name__ == "__main__":
    app.run(debug=True)
