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

# Extract total text lengths by user
def extract_user_text_density(data):
    user_text_density = {}
    for message in data:
        author = message.get('author', {})
        username = author.get('username', 'Unknown')  # Use 'Unknown' if username is not available
        user_text = message.get('content', '')  # Get the message content

        if user_text:  # Only consider messages with valid text
            message_length = len(user_text)  # Measure message length by character count
            if username in user_text_density:
                user_text_density[username] += message_length  # Accumulate length
            else:
                user_text_density[username] = message_length  # Initialize length

    return user_text_density

# Plot the text density by user
def plot_user_text_density(user_text_density):
    df = pd.Series(user_text_density).sort_values(ascending=False)  # Create a pandas Series and sort

    plt.figure(figsize=(10, 6))
    df.plot(kind='bar', title="Text Density by User (Total Characters)")
    plt.xlabel("Username")
    plt.ylabel("Total Characters")
    plt.xticks(rotation=45)
    plt.grid(axis='y')  # Add gridlines only on the y-axis
    plt.tight_layout()  # Adjust layout for better fit

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
    data = load_data_from_file('ObjectExample.txt')  # Ensure your file path is correct
    user_text_density = extract_user_text_density(data)
    img = plot_user_text_density(user_text_density)
    return send_file(img, mimetype='image/png')

if __name__ == "__main__":
    app.run(debug=True)
