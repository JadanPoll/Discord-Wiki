import tkinter as tk

def update_upper_limit(limit_num)
    spinbox.config(to=limit_num)  # Dynamically set the upper limit

# Create the main window
root = tk.Tk()
root.title("Numeric Spinbox Example")

# Create a Spinbox widget for selecting numbers
spinbox = tk.Spinbox(root, from_=0, to=100, increment=1, width=5)
spinbox.pack(padx=20, pady=20)

# Entry widget to input new upper limit
limit_entry = tk.Entry(root)
limit_entry.pack(padx=20, pady=5)

# Button to update the upper limit
update_button = tk.Button(root, text="Update Upper Limit", command=update_upper_limit)
update_button.pack(pady=10)

# Button to display the selected value
button = tk.Button(root, text="Show Selected Value", command=display_selected_value)
button.pack(pady=10)

# Run the Tkinter event loop
root.mainloop()
