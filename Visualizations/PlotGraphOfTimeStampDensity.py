import json
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
from flask import Flask, send_file
import io

app = Flask(__name__)

# Function to load JSON data from file with utf-8 encoding
def load_data_from_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        json_data = file.read()
    return json.loads(json_data)

# Function to handle different timestamp formats
def parse_timestamp(timestamp_str):
    try:
        # First, try to parse with microseconds
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%f%z")
    except ValueError:
        # If that fails, try without microseconds
        return datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S%z")

# Extract timestamps from the data
def extract_timestamps(data):
    timestamps = []
    for message in data:
        timestamp_str = message.get('timestamp')
        if timestamp_str:
            timestamp = parse_timestamp(timestamp_str)
            timestamps.append(timestamp)
    return timestamps

# Function to plot the density of timestamps and return the plot as a BytesIO object
def plot_timestamp_density(timestamps):
    # Convert datetime objects to numerical format (e.g., using matplotlib date format)
    numerical_timestamps = [ts.timestamp() for ts in timestamps]

    # Convert timestamps to a pandas series
    df = pd.Series(numerical_timestamps)

    # Create a density plot
    plt.figure(figsize=(10, 6))
    df.plot(kind='kde', title="Density Plot of Message Timestamps")
    plt.xlabel("Time (timestamp)")
    plt.ylabel("Density")
    plt.grid(True)

    # Save the plot to a BytesIO object and return it
    img = io.BytesIO()
    plt.savefig(img, format='png')
    img.seek(0)  # Rewind the buffer to the beginning
    plt.close()  # Close the plot to free memory
    return img

# Route to display the plot
@app.route('/plot')
def plot():
    data = load_data_from_file('ObjectExample.txt')  # Replace with your actual file
    timestamps = extract_timestamps(data)
    img = plot_timestamp_density(timestamps)
    
    return send_file(img, mimetype='image/png')

# Run the Flask app
if __name__ == "__main__":
    app.run(debug=True)
