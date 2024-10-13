import json
import pandas as pd
import matplotlib.pyplot as plt
from flask import Flask, render_template, send_file
import io

app = Flask(__name__)

# Function to load JSON data from file with utf-8 encoding
def load_data_from_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

# Extract message lengths from the data (based on character count)
def extract_message_lengths(data):
    message_lengths = []
    for message in data:
        user_text = message.get('content')
        if user_text:
            message_length = len(user_text)
            message_lengths.append(message_length)
    return message_lengths

# Plot the density of user text lengths
def plot_text_length_density(message_lengths):
    df = pd.Series(message_lengths)
    plt.figure(figsize=(10, 6))
    df.plot(kind='kde', title="Density Plot of User Text Lengths")
    plt.xlabel("Message Length (characters)")
    plt.ylabel("Density")
    plt.grid(True)
    plt.tight_layout()

    # Save plot to a BytesIO object
    img = io.BytesIO()
    plt.savefig(img, format='png')
    img.seek(0)
    plt.close()
    return img

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/plot')
def plot():
    data = load_data_from_file('ObjectExample.txt')
    message_lengths = extract_message_lengths(data)
    img = plot_text_length_density(message_lengths)
    return send_file(img, mimetype='image/png')

if __name__ == "__main__":
    app.run(debug=True)
