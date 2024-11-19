import tkinter as tk
from tkinter import messagebox
from tkinterweb import HtmlFrame  # Ensure tkinterweb is installed

# Dummy generator function (replace with your actual function)
class Generator:
    def generate_and_display_html(self, prefix, summary):
        # Simple HTML structure as an example
        return f"""
        <html>
            <body>
                <h1>{prefix} Summary</h1>
                <p>{summary}</p>
            </body>
        </html>
        """

# Function to handle the response and display it in an HTMLFrame
def handle_summary_response(summary):
    global summary_display
    global summary_popup
    
    if summary:
        # Generate HTML content for the summary (this can be modified as needed)
        html_result = generator.generate_and_display_html("Test", summary)
        print(html_result)

        # Create a new popup window to display the summary
        summary_popup = tk.Toplevel(app_main_window)
        summary_popup.title("Summary")
        summary_popup.geometry("500x300")
        
        # Create an HTMLFrame widget in the popup for displaying the summary
        summary_display = HtmlFrame(summary_popup, horizontal_scrollbar="auto")

        # Set the HTML content (Summary) to be displayed
        summary_display.load_html(html_result)  # Use the HTML content generated
        summary_display.pack(padx=10, pady=10, fill="both", expand=True)
        
    else:
        messagebox.showwarning("Warning", "No summary received from ChatGPT.")

# Initialize Tkinter window
app_main_window = tk.Tk()
app_main_window.title("Discord Conversation Context Chain Generator")
app_main_window.geometry("1200x600")  # Wider window for side-by-side display

# Initialize generator (replace with your actual generator)
generator = Generator()

# Example of how handle_summary_response would be used:
summary = "This is a test summary that will be displayed as HTML."
handle_summary_response(summary)

# Start the Tkinter GUI
app_main_window.mainloop()
