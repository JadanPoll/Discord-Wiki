import numpy as np
import logging
from sklearn.preprocessing import MinMaxScaler
from collections import defaultdict
import time
import matplotlib.pyplot as plt
import mplcursors
from tkinter import filedialog
from datetime import datetime
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import textstat


# Enable logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class BaseFactor:
    """Base class for factors used in the analysis. Extend this to create custom factors."""
    def __init__(self, weight=1.0):
        self.weight = weight  # Factor's influence on the final score

    def score(self, conversation_history):
        """Override this method to provide factor-specific scoring logic."""
        raise NotImplementedError("You need to implement the 'score' method.")







class UserImportanceFactor:
    """Factor based on the importance of users in the conversation."""
    
    def __init__(self, time_window, weight=1.0):
        self.weight = weight
        self.time_window = time_window
        self.user_scores = {}  # To store user scores

    def calculate_top_users(self, conversation_history):
        """Calculate top users based on frequency, content length, and density engagement."""
        logging.debug("Calculating top users based on frequency, content length, and density engagement...")
        
        # Preprocess messages by user with additional metrics
        user_data = {}
        timestamps = np.array([msg['timestamp'] for msg in conversation_history])

        for msg in conversation_history:
            user = msg['user']
            content = msg['content']
            timestamp = msg['timestamp']
            
            # Initialize user data if not present
            if user not in user_data:
                user_data[user] = {'count': 0, 'total_length': 0, 'density_engagement': 0}
            
            # Update message count and content length
            user_data[user]['count'] += 1
            user_data[user]['total_length'] += len(content)
            
            # Density engagement: Count messages in a time window around each message
            density_score = np.sum((timestamps >= timestamp - self.time_window) & (timestamps <= timestamp + self.time_window))
            user_data[user]['density_engagement'] += density_score

        # Calculate an overall score for each user based on weighted factors
        user_scores = {}
        for user, data in user_data.items():
            # Frequency Score
            frequency_score = data['count']
            # Average Content Length Score
            avg_length_score = data['total_length'] / max(data['count'], 1)  # Avoid divide by zero
            # Density Engagement Score (weighted by frequency to emphasize frequent contributors in dense periods)
            density_engagement_score = data['density_engagement'] / max(data['count'], 1)
            
            # Combined score for each user (weights can be fine-tuned)
            combined_score = (
                frequency_score * 0.4 +  # Emphasis on frequency
                avg_length_score * 0.3 +  # Emphasis on content length
                density_engagement_score * 0.3  # Emphasis on engagement in dense periods
            )
            user_scores[user] = combined_score

        # Get the top 5 users by score
        sorted_users = sorted(user_scores.items(), key=lambda item: item[1], reverse=True)
        top_users = {user for user, _ in sorted_users[:5]}
        
        self.user_scores = {user: user_scores[user] for user in top_users}  # Only keep top user scores
        logging.debug(f"Top users calculated: {self.user_scores}")

    def score(self, conversation_history):
        """Calculate the score for each message based on user importance."""
        # Calculate top users based on conversation history
        self.calculate_top_users(conversation_history)
        
        logging.debug("Calculating UserImportanceFactor scores...")
        scores = []
        for msg in conversation_history:
            user = msg['user']
            # Score is based on whether the user is important and their calculated score
            if user in self.user_scores:
                scores.append(self.user_scores[user])
            else:
                scores.append(0)
        
        # Convert to a numpy array and apply weight
        return np.array(scores) * self.weight



class TimestampDensityFactor:
    """Factor based on timestamp density (closeness of messages in time)."""
    def __init__(self, time_window, weight=1.0):
        self.time_window = time_window
        self.weight = weight

    def score(self, conversation_history):
        logging.debug("Calculating TimestampDensityFactor...")

        # Extract and sort timestamps for a sliding window approach
        timestamps = np.array(sorted(msg['timestamp'] for msg in conversation_history))
        n = len(timestamps)
        
        # Array to store density scores
        density_scores = np.zeros(n)
        
        # Sliding window for time density calculation
        start = 0
        for i in range(n):
            # Adjust the start of the window to keep timestamps within [ts - time_window, ts + time_window]
            while timestamps[i] - timestamps[start] > self.time_window:
                start += 1
            # Density count within the window is the difference in indices
            density_scores[i] = (i - start + 1) * self.weight

        return density_scores


class VocabularyComplexityFactor:
    """Factor based on the complexity of vocabulary in a conversation."""
    def __init__(self, weight=1.0):
        self.weight = weight

    def score(self, conversation_history):
        logging.debug("Calculating VocabularyComplexityFactor...")
        
        # Predefine max values for normalization
        MAX_WORDS = 100  # Arbitrary limit for word density normalization
        MAX_GRADE_LEVEL = 12  # Max grade level for Flesch-Kincaid
        MAX_SYLLABLES = 10  # Max syllables for normalization
        MAX_FOG_INDEX = 17  # Fog Index threshold for normalization
        MAX_DALE_CHALL = 10  # Dale-Chall score normalization cap
        
        # Pre-calculate weights for combination
        density_weight = 0.3
        grade_level_weight = 0.25
        syllable_weight = 0.15
        fog_weight = 0.15
        dale_chall_weight = 0.15

        # Initialize list to hold combined complexity scores
        combined_scores = []

        for msg in conversation_history:
            content = msg['content']
            words = content.split()
            word_count = MAX_WORDS if len(words) == 0 else len(words)
            unique_words = len(set(words))

            # Type-Token Ratio (TTR) for vocabulary density
            density_score = min((unique_words / word_count), 1) * self.weight

            # Calculate readability metrics
            grade_level = textstat.flesch_kincaid_grade(content)
            gunning_fog = textstat.gunning_fog(content)
            dale_chall = textstat.dale_chall_readability_score(content)
            syllable_count = textstat.syllable_count(content)

            # Normalize scores
            normalized_grade_level = min(grade_level / MAX_GRADE_LEVEL, 1)
            normalized_syllable_count = min(syllable_count / MAX_SYLLABLES, 1)
            normalized_fog = min(gunning_fog / MAX_FOG_INDEX, 1)
            normalized_dale_chall = min(dale_chall / MAX_DALE_CHALL, 1)

            # Combine scores using optimized weights
            combined_value = (
                density_score * density_weight +
                normalized_grade_level * grade_level_weight +
                normalized_syllable_count * syllable_weight +
                normalized_fog * fog_weight +
                normalized_dale_chall * dale_chall_weight
            )

            # Store the combined score
            combined_scores.append(combined_value)

        # Convert to numpy array for manipulation or return final result as needed
        return np.array(combined_scores)



class ContainsWordFactor(BaseFactor):
    """Factor based on specific keyword presence."""
    def __init__(self, keywords, weight=1.0):
        super().__init__(weight)
        self.keywords = keywords

    def score(self, conversation_history):
        logging.debug("Calculating ContainsWordFactor...")
        return np.array([1 if any(keyword.lower() in msg['content'].lower() for keyword in self.keywords) else 0 
                         for msg in conversation_history]) * self.weight

class ConversationAnalyzer:
    """Analyzes conversations by applying modular scoring factors."""
    
    def __init__(self, conversation_history):
        self.conversation_history = conversation_history
        self.factors = []
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
    def add_factor(self, factor: BaseFactor):
        self.factors.append(factor)
        
    def async_score(self, factor):
        """Asynchronously calculate scores for each factor."""
        start_time = time.time()
        score = factor.score(self.conversation_history)
        logging.info(f"{factor.__class__.__name__} computed in {time.time() - start_time:.4f}s")
        return score

    def analyze(self):
        """Run all factors in parallel and produce a final normalized PDF distribution."""
        total_scores = np.zeros(len(self.conversation_history))
        with ThreadPoolExecutor() as executor:
            futures = [executor.submit(self.async_score, factor) for factor in self.factors]
            for future in as_completed(futures):
                total_scores += future.result()

        total_scores = self.scaler.fit_transform(total_scores.reshape(-1, 1)).flatten()
        return total_scores

# Asynchronous file loading for large files
def load_conversation_history(file_path):
    try:
        with open(file_path, 'r', encoding="utf-8") as f:
            data = json.load(f)

        conversation_history = [{
            'user': msg['author']['global_name'],
            'timestamp': datetime.fromisoformat(msg['timestamp'].replace('Z', '+00:00')).timestamp(),
            'content': msg['content']
        } for msg in data]

        logging.info(f"Loaded {len(conversation_history)} messages from {file_path}")
        return conversation_history
    except Exception as e:
        logging.error(f"Error loading file: {e}")
        raise



def wrap_text(text, max_words):
    """Wraps text to a maximum number of words."""
    words = text.split()  # Split the text into words
    wrapped_lines = []  # List to hold wrapped lines

    # Iterate over the words and wrap them
    for i in range(0, len(words), max_words):
        wrapped_lines.append(' '.join(words[i:i + max_words]))  # Join up to max_words

    return '\n'.join(wrapped_lines)  # Join wrapped lines with newline



# Example Usage
if __name__ == "__main__":
    file_path = filedialog.askopenfilename()
    logging.info(f"Selected file: {file_path}")
    conversation_history = load_conversation_history(file_path)

    # Initialize the analyzer
    analyzer = ConversationAnalyzer(conversation_history)

    # Add modular factors
    #analyzer.add_factor(UserImportanceFactor( time_window=2,weight=0.3))
    #analyzer.add_factor(TimestampDensityFactor(time_window=2, weight=0.8))
    analyzer.add_factor(VocabularyComplexityFactor( weight=1.2))
    analyzer.add_factor(ContainsWordFactor(keywords=["@everyone"], weight=1.0))

    # Analyze and get the probability distribution
    pdf_distribution = analyzer.analyze()








    import tkinter as tk
    from tkinter import scrolledtext    
    import matplotlib.font_manager as fm
    import mplcursors
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg



    timestamps = [msg['timestamp'] for msg in conversation_history]
    pdf_distribution = np.random.random(len(conversation_history))  # Example scores

    # Emoji font for annotations
    emoji_font_path = r"C:/Windows/Fonts/seguiemj.ttf"  # Adjust as needed
    emoji_font = fm.FontProperties(fname=emoji_font_path)



    # Tkinter setup
    root = tk.Tk()
    root.title("Conversation and Graph Viewer")
    root.geometry("800x600")

    # Text display with scrollbar
    text_frame = tk.Frame(root)
    text_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    text_display = scrolledtext.ScrolledText(text_frame, wrap=tk.WORD, font=("Arial", 10))
    text_display.pack(fill=tk.BOTH, expand=True)

    # Add conversation messages to text area and tag each line
    for idx, msg in enumerate(conversation_history):
        line_text = f"{msg['user']}: {msg['content']}\n"
        text_display.insert(tk.END, line_text)
        text_display.tag_add(f"line_{idx}", f"{idx + 1}.0", f"{idx + 1}.end")
    text_display.config(state=tk.DISABLED)  # Make the text area read-only

    # Create Matplotlib figure
    fig, ax = plt.subplots(figsize=(5, 4))
    scatter = ax.scatter(timestamps, pdf_distribution, color='b', label='Conversation Score')
    ax.set_title('Conversation Score Over Time')
    ax.set_xlabel('Timestamp')
    ax.set_ylabel('Normalized Score')
    ax.grid(True)
    ax.legend(loc='upper left')

    # Matplotlib to Tkinter integration
    canvas = FigureCanvasTkAgg(fig, master=root)
    canvas.get_tk_widget().pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
    canvas.draw()

    # mplcursors for scatter plot interaction
    cursor = mplcursors.cursor(scatter, hover=True)

    def wrap_text(text, width):
        """Helper function to wrap text at a given width for annotation display."""
        return '\n'.join([text[i:i + width] for i in range(0, len(text), width)])

    @cursor.connect("add")
    def on_add(sel):
        index = sel.index
        message_content = wrap_text(conversation_history[index]['content'], 10)
        author = conversation_history[index]['user']
        
        # Show annotation in plot
        sel.annotation.set(text=f'{author}: {message_content}', fontsize=10, fontproperties=emoji_font)
        sel.annotation.get_bbox_patch().set(fc="lightblue", alpha=0.8)
        
        # Scroll to the corresponding message in text area
        text_display.config(state=tk.NORMAL)
        
        # Highlight the line and adjust scroll
        line_tag = f"line_{index}"
        text_display.tag_remove("highlight", "1.0", tk.END)  # Clear previous highlight
        text_display.tag_add("highlight", f"{index + 1}.0", f"{index + 1}.end")
        text_display.tag_config("highlight", background="yellow")
        text_display.yview(f"{index + 1}.0")  # Ensure line is in view
        
        text_display.config(state=tk.DISABLED)

    root.mainloop()