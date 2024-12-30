import os
import subprocess
import hmac
import hashlib
from flask import Flask, request, jsonify, send_file, abort,render_template, session
from flask_cors import CORS
import requests
import GroupTheoryAPINonGUI2
#import OpenAICMD
app = Flask(__name__, template_folder='templates', static_url_path='/', static_folder='static')
app.secret_key = 'D-SearchEngine@UIUC'

CORS(app)  # Enable CORS for all routes

# Define configuration variables
GIT_SCRIPT = "../../git.sh"
PORT = 3000
SECRET = os.getenv('SECRET')  # GitHub webhook secret from environment variables




# GitHub webhook handler
@app.route('/git', methods=['POST'])
def on_webhook():
    print("Webhook activated")
    
    # Validate the GitHub webhook signature
    signature = 'sha1=' + hmac.new(SECRET.encode(), request.data, hashlib.sha1).hexdigest()
    if (
        request.headers.get("X-GitHub-Event") == "push" and
        signature == request.headers.get("X-Hub-Signature")
    ):
        print("Processing push event...")

        # Ensure git.sh is executable
        try:
            subprocess.check_call("chmod +x {}".format(GIT_SCRIPT), shell=True)

            print("Permissions changed for git.sh")

            # Execute the git script
            if os.path.exists(GIT_SCRIPT):
                print("{} found, executing...".format(GIT_SCRIPT))
                subprocess.check_call(GIT_SCRIPT, shell=True)
            else:
                print("{} does not exist".format(GIT_SCRIPT))
                
            # Refresh the application. Might not be necessary but when I'm ediitng in glitch I do need to visually reset. Might not need in production
            subprocess.call("refresh", shell=True)

        except subprocess.CalledProcessError as e:
            print("Error in webhook processing: {}".format(e))

    return '', 200

# CORS bypass route for proxying requests
@app.route('/cors-bypass/<path:target_url>', methods=["GET", "POST", "PUT", "DELETE"])
def cors_bypass(target_url):
    try:
        auth_header = request.headers.get("Authorization")
        headers = {"Authorization": auth_header} if auth_header else {}
        print(headers)
        response = requests.request(
            method=request.method,
            url=target_url + "?" + request.query_string.decode("utf-8"),
            headers=headers,
            data=request.get_data()
        )
        print(response.headers.get('Content-Type'),response.status_code)



        # Check if the response is JSON
        if response.headers.get('Content-Type') == 'application/json':
            return jsonify(response.json()), response.status_code
        else:
            return jsonify({"error": "Response is not JSON", "content": response.text}), response.status_code

    except requests.RequestException as e:
        print("Error forwarding request:", e)
        return jsonify({"error": str(e)}), 500




@app.route("/")
def main():
    return render_template('frontpage.html')

@app.route('/visualize')
def visualize():
    return render_template('visualize/index.html', group='dev')

@app.route('/visualize/analysis')
def analyze():
    return render_template('visualize/analysis.html', group='dev')

@app.route("/visualize/live_server_update")
def live_update():
    return render_template('visualize/download/live_server_update.html', group='dev')

@app.route("/visualize/forzapagerank")
def pagerank():
    return render_template('visualize/download/forzapagerank', group='dev')

@app.route('/visualize/wordcloud')
def wordcloud():
    return render_template('visualize/wordcloud.html', group='dev')

@app.route('/visualize/plot_useractivity')
def plot_useractivity():
    return render_template('visualize/plot_useractivity.html', group='dev')

@app.route('/visualize/plot_timestamp_density')
def plot_timestamp_activity():
    return render_template('visualize/plot_timestamp_density.html', group='dev')

@app.route('/visualize/plot_textdensity_user')
def plot_textdensity_user():
    return render_template('visualize/plot_textdensity_user.html', group='dev')

@app.route('/visualize/plot_general_density')
def plot_general_density():
    return render_template('visualize/plot_general_density.html', group='dev')

@app.route('/storyboard')
def storyboard():
    return render_template('storyboard/storyboard.html', group='story')

@app.route('/content')
def content():
    return render_template('content/content.html', group='content')

@app.route('/character')
def character():
    return render_template('character/content.html', group='char')




@app.route('/generate-context-chain', methods=['POST'])
def generate_context_chain():

    py_generate_context_chain()
    # Handle generating the context chain (stub for now)
    context_radius = request.json.get('radius', 50)
    # Here you would implement the logic to generate the context chain
    return jsonify({"message": "Context chain generated", "radius": context_radius})











# Register callback for incoming summary responses
def handle_incoming_summary_response(summary):
    session["SUMMARY_RESPONSE"] = summary
#ChatGPT = OpenAICMD.WebSocketClientApp("https://ninth-swamp-orangutan.glitch.me")
#ChatGPT.register_callback(callback=handle_incoming_summary_response)
@app.route('/summarize', methods=['POST'])
def summarize():
    context_chain_text = request.json.get('context_chain_text')
    if not context_chain_text:
        return jsonify({"error": "No context chain text provided"}), 400

    session["SUMMARY_RESPONSE"] = None
    ChatGPT.send_message(
        "sendGPT",
        f"Summarize this context chain, focusing on relevant details and including references (e.g., DMessage 10): {context_chain_text}",
        learn=True
    )
    while session.get("SUMMARY_RESPONSE") is None:
        time.sleep(1)
    return jsonify({"summary": session["SUMMARY_RESPONSE"]})


@app.route('/load-conversation', methods=['POST'])
def load_conversation():
    # Initialize session variables for conversation blocks
    session['conversation_blocks'] = None
    session['processed_conversation_blocks'] = None

    # Get the filename from the request, it should be part of the request body (you can modify this as needed)
    filename = request.json.get("filename", "")

    if not filename:
        return jsonify({"error": "Filename is required"}), 400

    # Read the content of the file
    try:
        with open(filename, encoding="utf-8") as discord_messages_file:
            discord_message_data = json.load(discord_messages_file)
    except Exception as e:
        return jsonify({"error": f"Error reading file: {str(e)}"}), 500

    # Load and preprocess conversation blocks
    conversation_blocks, processed_conversation_blocks = group_and_preprocess_messages_by_author(discord_message_data)

    # Save the processed conversation data in the session
    session[PATHINGS_DICT["CONVERSATION_BLOCKS"]] = conversation_blocks
    session[PATHINGS_DICT["PROCESSED_CONVERSATION_BLOCKS"]] = processed_conversation_blocks

    # Generate independent groups and hierarchical relationships
    independent_groups, hierarchical_relationships = generate_and_display_all_random_context_chain()

    # Return success response along with conversation blocks, glossary, independent groups, and hierarchical relationships
    return jsonify({
        "message": f"Conversation loaded from {filename}",
        "conversation_blocks": session[PATHINGS_DICT["CONVERSATION_BLOCKS"]],
        "glossary": session.get(PATHINGS_DICT["GLOSSARY"], {}),
        "independent_groups": independent_groups,
        "hierarchical_relationships": hierarchical_relationships
    }), 200


@app.route('/save-glossary', methods=['POST'])
def save_glossary():
    session["GLOSSARY_FILEPATH"] = session["GLOSSARY"]
    # Handle saving glossary (stub for now)
    return jsonify({"message": "Glossary saved"})


@app.route('/save-summary', methods=['POST'])
def save_summary():
    session["SUMMARIES_FILEPATH"] = session["SUMMARY"]
    # Handle saving conversation summaries (stub for now)
    return jsonify({"message": "Summary saved"})















#####################################################################################
PATHINGS_DICT = {
    "CONVERSATION_BLOCKS": "CONVERSATION_BLOCKS",
    "PROCESSED_CONVERSATION_BLOCKS": "PROCESSED_CONVERSATION_BLOCKS",
    "CONVERSATION_TOPIC_TREE": "CONVERSATION_TOPIC_TREE",
    "FOUND_ID": "FOUND_ID",
    "GLOSSARY": "GLOSSARY",
    "SUMMARY": "SUMMARY"
}


import json
import threading
from textrank4zh import TextRank4Keyword
from kneed import KneeLocator
import spacy
import time
import glossal_compression
with open('./discord-stopword-en.json', encoding='utf-8') as stopword_file:
    loaded_stopwords = set(json.load(stopword_file))

punctuations = r"""",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“`"""

def preprocess_message_text(message_text):
    words = message_text.translate(str.maketrans('', '', punctuations)).split()
    result = []

    for word in words:
        if word.lower().startswith('http'):
            translated_text = word.translate(str.maketrans(":/. -", "     "))
            result.extend(
                part for part in translated_text.split(' ')
                if part.lower() not in {'http', 'com', 'www', 'ai'} and part.lower() not in loaded_stopwords
            )
        elif word.lower() not in loaded_stopwords or (word.isupper() and len(word) > 1):
            result.append(word)

    return result

def group_and_preprocess_messages_by_author(message_data):
    conversation_blocks = []
    processed_conversation_blocks = []
    current_author = None
    author_messages = []

    if isinstance(message_data, dict) and "messages" in message_data:
        message_data = message_data["messages"]

    for message_entry in message_data:
        author_name = message_entry["author"].get("name") or message_entry["author"].get("username")

        if author_name != current_author:
            if author_messages:
                joined_message_block = " ".join(author_messages)
                conversation_blocks.append(joined_message_block)
                processed_conversation_blocks.append(" ".join(preprocess_message_text(joined_message_block)))
            current_author = author_name
            author_messages = []

        if "content" in message_entry:
            author_messages.append(message_entry["content"])

    if author_messages:
        joined_message_block = " ".join(author_messages)
        conversation_blocks.append(joined_message_block)
        processed_conversation_blocks.append(" ".join(preprocess_message_text(joined_message_block)))

    return conversation_blocks, processed_conversation_blocks




def generate_and_display_all_random_context_chain():
    """
    Autonomously finds and generates context chains for all conversations.
    Ensures no duplicate processing for conversations already found.
    """
    processed_conversation_blocks = session.get(PATHINGS_DICT["PROCESSED_CONVERSATION_BLOCKS"], [])
    found_ids = session.get(PATHINGS_DICT["FOUND_ID"], set())

    session[PATHINGS_DICT["CONVERSATION_TOPIC_TREE"]] = {}
    session[PATHINGS_DICT["FOUND_ID"]] = found_ids

    print(len(processed_conversation_blocks))

    for index in range(len(processed_conversation_blocks)):
        if index not in found_ids:
            generate_and_display_random_context_chain2(index)

    # Start a new thread for glossary generation
    return generate_glossary()



def generate_and_display_random_context_chain2(index=None):
    """
    Generates and displays a context chain for a specific conversation block.
    If `index` is provided, it processes that specific conversation block; otherwise, 
    it picks a random block to process.
    """
    processed_conversation_blocks = session.get(PATHINGS_DICT["PROCESSED_CONVERSATION_BLOCKS"], [])
    conversation_blocks = session.get(PATHINGS_DICT["CONVERSATION_BLOCKS"], [])

    try:
        search_radius = int(context_radius_input.get())
    except ValueError:
        output_text_display.insert(tk.END, "Please enter a valid number for context search radius.\n")
        return

    if processed_conversation_blocks:
        block_index = index or 0  # Default to the first block if no index is provided
        block_words = set(processed_conversation_blocks[block_index].split())
        visited_block_indices = {block_index}
        context_chain = [(block_index, conversation_blocks[block_index], 1)]

        construct_context_chain(block_words, search_radius, block_index, visited_block_indices, context_chain)

        if len(context_chain) < search_radius // 4 and index is not None:
            session[PATHINGS_DICT["FOUND_ID"]].add(index)
            return

        context_chain.sort()
        topic_id = str(block_index)
        
        session[PATHINGS_DICT["CONVERSATION_TOPIC_TREE"]][topic_id] = [
            {"message": msg, "message_id": blk_id} for blk_id, msg, _ in context_chain
        ]
        session[PATHINGS_DICT["FOUND_ID"]].update(blk_id for blk_id, _, _ in context_chain)




# Optimized function to search for a query within a message block using set operations
def find_query_in_message_block(query_set, message_block):
    # Split the message block into words and create a set for fast lookup
    message_block_words = set(message_block.split())

    # Check for any intersection between the query set and the message block words
    return not query_set.isdisjoint(message_block_words)



def construct_context_chain(inherited_words_set, search_radius, current_message_index, visited_indices, context_chain, recursion_depth=1):
    processed_conversation_blocks = session.get(PATHINGS_DICT["PROCESSED_CONVERSATION_BLOCKS"], [])
    conversation_blocks = session.get(PATHINGS_DICT["CONVERSATION_BLOCKS"], [])

    start_index = max(0, current_message_index - search_radius)
    end_index = min(len(processed_conversation_blocks), current_message_index + search_radius + 1)

    for block_index in range(start_index, end_index):
        if block_index not in visited_indices and find_query_in_message_block(inherited_words_set, processed_conversation_blocks[block_index]):
            visited_indices.add(block_index)
            context_chain.append((block_index, conversation_blocks[block_index], recursion_depth))

            expanded_word_set = inherited_words_set.union(processed_conversation_blocks[block_index].split())

            construct_context_chain(expanded_word_set, max(search_radius // 2, 1), block_index, visited_indices, context_chain, recursion_depth + 1)




text_rank = TextRank4Keyword()
text_rank.analyze("Removing cold start", window=5, lower=True)  # Reducing cold start

nlp = spacy.load("en_core_web_sm")

def filter_words_by_pos(words, pos_tags):
    doc = nlp(' '.join(words))
    return [token.text for token in doc if token.pos_ in pos_tags]


from textblob import TextBlob

def filter_words_by_pos(words, pos_tags):
    """
    Filters words from an array based on the given list of POS tags.
    
    :param words: A list of words (strings).
    :param pos_tags: A list of POS tags to keep (e.g., ['NN', 'VB']).
    :return: A list of words that match the specified POS tags.
    """
    return [word for word, tag in TextBlob(' '.join(words)).tags if tag in pos_tags]

def extract_topics(text):
    text_rank.analyze(text, window=5, lower=True)
    keywords = text_rank.get_keywords(100, word_min_len=3)
    scores = [kw.weight for kw in keywords]
    
    if not scores:
        return []
    
    knee_locator = KneeLocator(range(1, len(scores) + 1), scores, curve="convex", direction="decreasing")
    cutoff = knee_locator.knee or len(scores)
    optimal_keywords = [kw.word for kw in keywords[:cutoff]]
    return filter_words_by_pos(optimal_keywords, ['NN'])

def generate_conversation_topics():
    conversation_topic_tree = session.get(PATHINGS_DICT["CONVERSATION_TOPIC_TREE"], {})
    if not conversation_topic_tree:
        output_text_display.insert(tk.END, "\nNo topics available to process.\n")
        return
    
    for i, (topic_id, convo) in enumerate(conversation_topic_tree.items()):
        total = "\n".join(
            session[PATHINGS_DICT["PROCESSED_CONVERSATION_BLOCKS"]][entry["message_id"]] for entry in convo
        )
        convo.append({"description": extract_topics(total)})
        print(f"Next: {i}")


def construct_glossary():
    conversation_topic_tree = session.get(PATHINGS_DICT["CONVERSATION_TOPIC_TREE"], {})
    glossary = session.get(PATHINGS_DICT["GLOSSARY"], {})
    
    if not conversation_topic_tree:
        return

    for topic_data in conversation_topic_tree.values():
        description = topic_data[-1].get("description", "")
        if not description:
            print("not here")
            continue

        message_ids = [entry["message_id"] for entry in topic_data if "message_id" in entry]

        for keyword in description:
            glossary.setdefault(keyword, []).append(message_ids)





def intersect_compressor(data):
    print("Compressing...")
    complete_start = time.time()
    

    for keyword, entries in data.items():
        data[keyword] = glossal_compression.compress_glossary_entries(keyword, entries, 0.7)

    print(f"End of compression: {time.time() - complete_start}")
    return data

def generate_glossary():
    glossary = session.get(PATHINGS_DICT["GLOSSARY"], {})
    generate_conversation_topics()
    construct_glossary()
    glossary = intersect_compressor(glossary)
    return GroupTheoryAPINonGUI2.update_clustering( glossary)
