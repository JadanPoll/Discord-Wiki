import tkinter as tk
from tkinter import messagebox
from gensim.models import KeyedVectors
import time
# Load the pre-trained Word2Vec model (make sure 'GoogleNews-vectors-negative300.bin' is in the correct path)
model_path = "../../../NLP_DataSet/GoogleNews-vectors-negative300.bin"
start=time.time()
model = KeyedVectors.load_word2vec_format(model_path, binary=True)
print(time.time()-start)
# Function to find similar words
def find_similar_words():
    input_word = entry.get()
    
    # Check if the word exists in the model's vocabulary
    if input_word in model:
        try:
            # Get the most similar words
            similar_words = model.most_similar(input_word, topn=50)
            result_text = "\n".join([f"{word}: {similarity:.4f}" for word, similarity in similar_words])
            result_label.config(text=result_text)
        except KeyError:
            messagebox.showerror("Error", f"Word '{input_word}' not found in the model's vocabulary.")
    else:
        messagebox.showerror("Error", f"Word '{input_word}' not found in the model's vocabulary.")

# Create the main window
root = tk.Tk()
root.title("Word2Vec Similar Words Finder")

# Create and place widgets
label = tk.Label(root, text="Enter a word:")
label.pack(pady=5)

entry = tk.Entry(root, width=30)
entry.pack(pady=5)

button = tk.Button(root, text="Find Similar Words", command=find_similar_words)
button.pack(pady=10)

result_label = tk.Label(root, text="", justify="left")
result_label.pack(pady=10)

# Run the Tkinter event loop
root.mainloop()
