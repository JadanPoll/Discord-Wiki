import json
import pandas as pd
import matplotlib.pyplot as plt

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

    # Save the plot to a file or display it
    plt.savefig("user_activity.png")  # Save as a PNG file
    plt.show()  # Display the plot

# Main function
def main():
    data = load_data_from_file('ObjectExample.txt')  # Ensure your file path is correct
    user_activity = extract_user_activity(data)
    plot_user_activity(user_activity)

if __name__ == "__main__":
    main()
