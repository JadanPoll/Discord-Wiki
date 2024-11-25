from transformers import pipeline

# Assume 'retrieved_messages' is a list of message contents
retrieved_messages = [
    'are lab 10 and 11 not shown on github?', 'github sorts directories lexicographically however you spell that word', 'oh right', "so they're at the top", 'lol, i c', 'what does sorting lexicographically mean', "It's an alphabetical sort order It'd be more accurate to say alphanumeric order Basically a way of sorting strings of characters", '"Looking at shit letter by letter instead of entire words" Bros using all of this fancy language', "that's so much to type out", 'I mean it also doesnt mean the same thing Lexicographic order is a well-defined sort order', 'Challenge for pro: make random number generator', 'bruh you dont need to be a pro to do that :catrave:', 'Oh Bruh How would one even start', 'using LC3?', 'Yes', 'just use LCG or something LCG should be the most simple way to tackle it', 'I don’t think that’s a command', 'nah, thats an algorithm its not totally random but good enough for most people'
]

total_characters = sum(len(message) for message in retrieved_messages)
max_char = int(total_characters/5)
min_char = int(total_characters/50)

# Combine all messages into one text
combined_text = " ".join(retrieved_messages)

# Load a summarization pipeline
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

# Generate the summary
summary = summarizer(combined_text, max_length=max_char, min_length=min_char, do_sample=False)

# Display the summary
print(summary[0]['summary_text'])
print(total_characters)