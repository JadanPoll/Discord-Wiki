import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import mplcursors

# Load a font that supports emojis
# You can specify the path to your emoji font if needed
emoji_font_path = r"C:/Windows/Fonts/seguiemj.ttf"  # Update this path as needed
emoji_font = fm.FontProperties(fname=emoji_font_path)

def wrap_text(text, max_words):
    """Wraps text to a maximum number of words."""
    words = text.split()
    wrapped_lines = []
    for i in range(0, len(words), max_words):
        wrapped_lines.append(' '.join(words[i:i + max_words]))
    return '\n'.join(wrapped_lines)

# Sample conversation history with emojis
conversation_history = [
    {'content': 'Hello 😊, how are you doing today?', 'user': 'User1'},
    {'content': 'This is a sample message that will be wrapped to demonstrate the text wrapping functionality. 👍', 'user': 'User2'},
    {'content': 'Another message that is quite long and needs to be wrapped properly. 🚀', 'user': 'User3'}
]

# Sample scatter plot
x = [1, 2, 3]
y = [3, 2, 1]
scatter = plt.scatter(x, y)

# mplcursors setup
cursor = mplcursors.cursor(scatter, hover=True)

@cursor.connect("add")
def on_add(sel):
    message_content = wrap_text(conversation_history[sel.index]['content'], 10)
    author = conversation_history[sel.index]['user']
    # Use the emoji font in the annotation
    sel.annotation.set(text=f'{author}: {message_content}', fontsize=10, fontproperties=emoji_font)
    sel.annotation.get_bbox_patch().set(fc="lightblue", alpha=0.8)

plt.show()
