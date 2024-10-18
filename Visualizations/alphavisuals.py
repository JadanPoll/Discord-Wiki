import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import importlib.util
import os
from PIL import Image, ImageTk
import matplotlib.pyplot as plt

# Global variable to store the selected directory
visualization_directory = ""
# Global variable to store the last used directory
last_used_directory = r"Visualizations/VisualLib"  # Default to the current working directory

# Function to load a visualization script dynamically
def load_visualization_script(file_path):
    try:
        # Clear previous plots if any
        for widget in plot_frame.winfo_children():
            widget.destroy()

        # Load the module dynamically from the selected file path
        spec = importlib.util.spec_from_file_location("visualization_module", file_path)
        visualization_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(visualization_module)

        # Call the 'main' function if it exists
        if hasattr(visualization_module, 'main'):
            visualization_module.main()
        else:
            messagebox.showerror("Error", "The selected file does not have a 'main()' function.")
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {e}")

# Function to select the directory containing the visualization scripts
def select_directory():
    global visualization_directory, last_used_directory
    # Use last used directory as the starting point
    visualization_directory = filedialog.askdirectory(
        initialdir=last_used_directory,
        title="Select Directory Containing Visualization Scripts"
    )
    if visualization_directory:
        last_used_directory = visualization_directory  # Update last used directory
        populate_treeview()

# Function to populate the Treeview with filenames
def populate_treeview():
    tree.delete(*tree.get_children())  # Clear the treeview

    for filename in os.listdir(visualization_directory):
        if filename.endswith('.py'):
            tree.insert('', 'end', filename, text=filename, image=file_icon)

# Function to handle the event when an item in the tree is clicked
def on_item_selected(event):
    selected_item = tree.focus()
    filename = tree.item(selected_item, 'text')
    file_path = os.path.join(visualization_directory, filename)

    if file_path:
        load_visualization_script(file_path)

# Function to handle drag and drop
def on_file_drop(event):
    file_path = event.data
    if file_path.endswith('.py'):
        load_visualization_script(file_path)

# Setting up the main Tkinter window
def main():
    global plot_frame, tree, file_icon

    # Main window configuration
    root = tk.Tk()
    root.title("Discord-Themed Visualization Loader")
    root.geometry("900x600")
    root.configure(bg="#5865F2")

    # Sidebar frame for directory selection and file tree
    sidebar_frame = tk.Frame(root, bg="#404EED", width=220)
    sidebar_frame.pack(side='left', fill='y')

    # Create a button to select the directory containing visualizations
    directory_button = tk.Button(
        sidebar_frame,
        text="Select Directory",
        command=select_directory,
        bg="#7289DA",
        fg="white",
        font=("Helvetica", 12, "bold"),
        relief="flat",
        padx=10,
        pady=5
    )
    directory_button.pack(pady=20)

    # Load icon for files (ensure you have an icon or image in the working directory)
    try:
        file_icon = ImageTk.PhotoImage(Image.open("Visualizations/file_icon.png").resize((16, 16)))
    except Exception:
        file_icon = None

    # Create a Treeview widget to display filenames
    tree = ttk.Treeview(sidebar_frame)
    tree.heading("#0", text="Visualization Files", anchor='w')
    tree.bind("<Double-1>", on_item_selected)  # Double-click event binding
    tree.pack(fill='both', expand=True, pady=10)

    # Style customization for Treeview
    style = ttk.Style()
    style.theme_use("clam")
    style.configure("Treeview",
                    background="#5865F2",
                    foreground="white",
                    rowheight=25,
                    fieldbackground="#5865F2",
                    borderwidth=0)
    style.map('Treeview', background=[('selected', '#404EED')])

    # Frame for displaying plots
    plot_frame = tk.Frame(root, bg="#FFFFFF")
    plot_frame.pack(side='right', fill='both', expand=True)

    # Display welcome message
    welcome_label = tk.Label(
        plot_frame,
        text="Drop a file or select a directory to begin.\nDouble-click on a file to view the visualization.",
        bg="white",
        fg="#5865F2",
        font=("Helvetica", 14),
        wraplength=400,
        justify="center"
    )
    welcome_label.pack(expand=True)

    # Bind drag-and-drop functionality
    #root.drop_target_register(DND_FILES)
    #root.dnd_bind('<<Drop>>', on_file_drop)

    root.mainloop()

if __name__ == "__main__":
    main()
