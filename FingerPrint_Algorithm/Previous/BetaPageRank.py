import tkinter as tk
from tkinter import scrolledtext
import json
import random
from matplotlib import cm

# Load stopwords from JSON file
stopwords = []
with open('./discord-stopword-en.json', encoding='utf-8') as f:
    stopwords = json.load(f)



# Load and parse text conversations from JSON file
text_conversations = []
with open('./CEMU_discord_messages.json', encoding="utf-8") as f:
    data = json.load(f)

# Initialize variables to track the current message and author
current_author = None
current_message = []

for entry in data:
    # Check if the current entry has a "content" field and "author" field
    if "content" in entry and "author" in entry and "username" in entry["author"]:
        author = entry["author"]["username"]
        
        # If this is the same author as the previous message, append to current message
        if author == current_author:
            current_message.append(entry["content"])
        else:
            # If it's a new author, save the previous message (if any)
            if current_message:
                text_conversations.append("\n".join(current_message))  # Join all segments into one message
            
            # Start a new message with the new author
            current_author = author
            current_message = [entry["content"]]

# Add the last message to text_conversations (if any)
if current_message:
    text_conversations.append("\n".join(current_message))




# Remove stopwords from each conversation and create preprocessed texts for searching
processed_text_conversations = []
for text in text_conversations:
    words = text.split()
    filtered_text = " ".join([word for word in words if word.lower() not in stopwords])
    processed_text_conversations.append(filtered_text)

# Recursive function to build the context chain using preprocessed texts for search
def recursive_chain_build(word_list, search_range, processed_index, matched_indices, chain, depth=1):
    start_index = max(0, processed_index - search_range)
    end_index = min(len(processed_text_conversations), processed_index + search_range + 1)
    context_texts = processed_text_conversations[start_index:end_index]

    for context in context_texts:
        context_index = processed_text_conversations.index(context)
        if context_index not in matched_indices:
            # Check if any word from the word_list is in the preprocessed context
            if any(word in context.split() for word in word_list):
                matched_indices.add(context_index)  # Mark as matched to avoid duplicates
                chain.append((context_index, text_conversations[context_index], depth))  # Add index, text, and depth
                new_words = context.split()  # Use words from the preprocessed context to expand
                recursive_chain_build(new_words, max(search_range // 2, 1), context_index, matched_indices, chain, depth + 1)

# Function to generate color based on depth (warm for low depth, cool for high depth)
def get_shade(depth, max_depth):
    # Calculate the ratio of depth to maximum depth
    ratio = depth / max_depth
    
    # Red stays constant at 255
    red = 255
    
    # Green and Blue start at 0 (for full red) and increase towards 192 (for pale red)
    green_blue = int(255 * ratio)
    

    if depth == 1:
        return f"#{166:02x}{166:02x}{166:02x}" # Gold (120,81,169)
    # Convert the RGB values to a hexadecimal color code
    return f"#{red:02x}{green_blue:02x}{green_blue:02x}"

# Function to generate context chain from random selection
def generate_context_chain():
    chain = []
    result_display.delete('1.0', tk.END)  # Clear previous results

    try:
        # Retrieve and convert the search range from Entry widget
        search_range = int(chain_number.get())
    except ValueError:
        result_display.insert(tk.END, "Please enter a valid number for search range.\n")
        return

    if processed_text_conversations:
        # Select a random processed text for the search
        random_text = random.choice(processed_text_conversations)
        random_text_index = processed_text_conversations.index(random_text)
        word_list = random_text.split()  # Initial list of words to search around

        # Create a set to track matched indices and avoid duplicates
        matched_indices = set()
        matched_indices.add(random_text_index)  # Mark the starting index

        # Start building the context chain with original unprocessed text
        chain.append((random_text_index, text_conversations[random_text_index], 1))  # Store index and depth
        recursive_chain_build(word_list, search_range, random_text_index, matched_indices, chain)

        # Sort chain by index to preserve chronological order
        chain.sort(key=lambda x: x[0])  # Sort by index (x[0])

        # Determine max depth for color normalization
        max_depth = max(depth for _, _, depth in chain)

        # Display results in the GUI with color gradients
        result_display.insert(tk.END, "Selected Text:\n", "selected")
        result_display.insert(tk.END, f"{text_conversations[random_text_index]}\n\n", "selected")

        result_display.insert(tk.END, "Stopword Filtered:\n", "filtered")
        result_display.insert(tk.END, f"{processed_text_conversations[random_text_index]}\n\n", "filtered")

        result_display.insert(tk.END, "Context Chain Messages:\n", "context")
        
        for _, message, depth in chain:
            shade = get_shade(depth, max_depth)
            tag_name = f"context_depth_{depth}"
            result_display.tag_configure(tag_name, background=shade, foreground="black")
            result_display.insert(tk.END, f"{message}\n{'-'*50}\n", tag_name)

# Set up the main Tkinter window
root = tk.Tk()
root.title("Discord Context Chain Generator")
root.geometry("800x600")

# Label and Entry widget for search range
tk.Label(root, text="Enter search range for context chain:").pack(pady=5)
chain_number = tk.Entry(root)
chain_number.insert(0, "50")  # Set a default value
chain_number.pack(pady=5)

# Instruction label
instruction_label = tk.Label(root, text="Generate a context chain from random Discord messages", font=("Arial", 14))
instruction_label.pack(pady=10)

# Generate button
generate_button = tk.Button(root, text="Generate Context Chain", command=generate_context_chain,
                            font=("Arial", 12), bg="#4CAF50", fg="white")
generate_button.pack(pady=10)

# Scrolled text box to display the results
result_display = scrolledtext.ScrolledText(root, wrap=tk.WORD, width=80, height=25, font=("Arial", 10))
result_display.pack(padx=10, pady=10)

# Define text color tags for selected and filtered messages
result_display.tag_configure("selected", background="#DDEEFF", foreground="#003366")  # Dark blue for selected
result_display.tag_configure("filtered", background="#E0FFE0", foreground="#006600")  # Green for stopword filtered

# Run the Tkinter event loop
root.mainloop()