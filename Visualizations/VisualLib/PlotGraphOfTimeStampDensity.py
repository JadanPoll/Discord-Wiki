import json
import pandas as pd
import plotly.express as px
from datetime import datetime
import numpy as np

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

# Function to create an interactive heatmap with a slider
def create_interactive_heatmap(timestamps):
    # Create a DataFrame from the timestamps
    df = pd.DataFrame({'timestamp': timestamps})
    df['date'] = df['timestamp'].dt.date
    df['hour'] = df['timestamp'].dt.hour

    # Group data by date and hour, and count messages
    grouped = df.groupby(['date', 'hour']).size().reset_index(name='message_count')

    # Create a pivot table
    pivot_table = grouped.pivot(index='hour', columns='date', values='message_count').fillna(0)

    # Create the heatmap figure
    fig = px.imshow(
        pivot_table,
        labels=dict(x="Date", y="Hour of Day", color="Message Count"),
        x=pivot_table.columns,
        y=pivot_table.index,
        aspect="auto",
        color_continuous_scale='Viridis'
    )

    # Update layout to add a slider
    fig.update_layout(
        title='Interactive Heatmap of Message Density Over Time',
        xaxis_nticks=20,
        xaxis_title='Date',
        yaxis_title='Hour of Day',
        yaxis_nticks=24,
        autosize=False,
        width=1000,
        height=600,
    )

    # Add date slider
    fig.update_xaxes(
        rangeslider_visible=True,
        rangeselector=dict(
            buttons=list([
                dict(count=1, label="1d", step="day", stepmode="backward"),
                dict(count=7, label="1w", step="day", stepmode="backward"),
                dict(count=1, label="1m", step="month", stepmode="backward"),
                dict(step="all")
            ])
        )
    )

    fig.show()

# Main function
def main():
    data = load_data_from_file('ObjectExample.txt')  # Ensure your file path is correct
    timestamps = extract_timestamps(data)
    create_interactive_heatmap(timestamps)

if __name__ == "__main__":
    main()
