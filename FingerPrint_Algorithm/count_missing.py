import json
import tkinter as tk
from tkinter import filedialog

def find_missing_numbers(data):
    # Flatten all numbers from the lists in the dictionary
    all_numbers = []
    for key, value in data.items():
        if isinstance(value, list):
            for sublist in value:
                if isinstance(sublist, list):
                    all_numbers.extend(sublist)

    # Find the max and min values
    max_number = max(all_numbers)
    min_number = min(all_numbers)

    # Calculate the total numbers in the range and find the missing numbers
    total_numbers_in_range = set(range(min_number, max_number + 1))
    present_numbers = set(all_numbers)

    missing_numbers = sorted(total_numbers_in_range - present_numbers)

    # Print results
    print(f"Max number: {max_number}")
    print(f"Min number: {min_number}")
    print(f"Missing numbers in between: {len(missing_numbers)}")
    print(f"Missing numbers: {missing_numbers}")


def load_file_via_dialog():
    # Open a tkinter file dialog to select a file
    root = tk.Tk()
    root.withdraw()  # Hide the root window

    # Ask the user to select a file
    file_path = filedialog.askopenfilename(
        title="Select JSON file", 
        filetypes=(("JSON Files", "*.json"), ("All Files", "*.*"))
    )

    if file_path:
        with open(file_path, 'r') as file:
            data = json.load(file)
        
        find_missing_numbers(data)
    else:
        print("No file selected.")


# Run the function to open file dialog and process the selected file
load_file_via_dialog()
