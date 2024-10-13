import json
import pandas as pd
import matplotlib.pyplot as plt
from flask import Flask, render_template, send_file
import io

app = Flask(__name__)

# Load data from a JSON file
def load_data_from_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

# Extract the message count per user
def extract_user_activity(data):
    user_activity = {}
    for message in data:
        author = message.get('author', {})
        username = author.get('username', 'Unknown')
        if username in user_activity:
            user_activity[username] += 1
        else:
            user_activity[username] = 1
    return user_activity

# Plot user activity as a bar chart
def plot_user_activity(user_activity):
    df = pd.Series(user_activity).sort_values(ascending=False)
    plt.figure(figsize=(10, 6))
    df.plot(kind='bar', title="User Activity (Number of Messages)")
    plt.xlabel("Username")
    plt.ylabel("Message Count")
    plt.xticks(rotation=45)
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
    data = load_data_from_file('ObjectExample.txt')  # Ensure your file path is correct
    user_activity = extract_user_activity(data)
    img = plot_user_activity(user_activity)
    return send_file(img, mimetype='image/png')

if __name__ == "__main__":
    app.run(debug=True)
