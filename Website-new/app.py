import os
import subprocess
import hmac
import hashlib
from flask import Flask, request, jsonify, send_file, abort,render_template, send_from_directory, session
from flask_cors import CORS
import requests
from flask_session import Session
import json
import os
from flask import Flask, redirect, request, session, url_for, jsonify
import datetime
import random

app = Flask(__name__, template_folder='templates', static_url_path='/', static_folder='static')
app.secret_key = "DSearchPokémon"
CORS(app)  # Enable CORS for all routes

# Configure Flask-Session
app.config['SESSION_TYPE'] = 'filesystem'  # Use 'redis', 'sqlalchemy', or others for production
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_FILE_DIR'] = './flask_session'
Session(app)

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
    # check if DB is available
    if 'db' not in session and 'glossary_exists' not in session:
        return render_template('frontpage_nodb.html',include_search=False, isintro=True)

    return render_template('frontpage.html', activefile=session["db"])


# AUX to /, probably just i'm feeling lucky
@app.route("/bored")
def bored():
    res = random.choice(list(session[f"glossary_{session['db']}"].keys()))
    return redirect(f"/servertitlescreen?filename={session['db']}&keyword={res}")

@app.route('/visualize')
def visualize():
    return render_template('visualize/index.html', group='dev')

@app.route('/visualize/analysis')
def analyze():
    return render_template('visualize/analysis.html', group='dev')


# Dynamic route to handle filename
@app.route('/servertitlescreen')
def titlescreen():
    # Retrieve the 'filename' parameter from the query string
    filename = request.args.get('filename')
    
    if filename:
        # Pass the filename to the template
        return render_template('visualize/servertitlescreen.html', filename=filename, group='server')
    else:
        # See if we can redirect to active file
        if "db" in session:
            return redirect(f"/servertitlescreen?filename={session['db']}")

        return "Filename parameter is missing and active DB file is not found.", 400

@app.route("/visualize/live_server_update")
def live_update():
    #return redirect('/login')
    return render_template('visualize/download/live_server_update.html', group='dev')

@app.route("/visualize/forzapagerank")
def pagerank():
    return render_template('visualize/download/forzapagerank.html', group='dev')


@app.route("/listfiles")
def listfiles():
    # prepare data, i.e. a single array containing all the req'd info
    res = []

    # traverse dblist in REVERSE order; this in effect sorts in recent
    if "dblist" in session and len(session["dblist"]) != 0:
        id: str # does nothing tbh, just easy linting
        for id in session["dblist"][::-1]:
            # calc dl'd datetime using epoch
            # https://stackoverflow.com/questions/26276906/python-convert-seconds-from-epoch-time-into-human-readable-time
            createdAt = ""
            try:
                if "_" in id: # if it doesnt exist theres either error or we're using old format...
                    epoch = id.split("_")[1]
                    print(epoch)
                    parseddt = datetime.datetime.fromtimestamp(int(epoch)/1000)
                    createdAt = parseddt.strftime("%d %b %Y, %H:%M:%S") #'%Y-%m-%d %H:%M:%S' can be used, but really?
            except Exception as e:
                print(e)

            # determine nickname if exists, otherwise default to ""
            nickname = ""
            if id in session["messages_nicknames"]:
                nickname = session["messages_nicknames"][id]
            
            # push in
            res.append({
                "id": id,
                "nickname": nickname,
                "createdAt": createdAt,
                "isActive": (id == session["db"])
            })
    else:
        return render_template('listfiles.html', dblist=None, activefile="", group='files')
    return render_template('listfiles.html', dblist=res, activefile=session["db"], group='files')

# saveactivefile GET route is aux to listfiles.

# Aux to listfiles
@app.route("/deletefile")
def deletefile():
    # get args
    id = ""
    try:
        id = request.args.get("fileid")
    except Exception as e:
        return jsonify({"error": str(e)}), 404 # means no argument
    
    if id not in session["dblist"]:
        # invalid request
        return jsonify({"error": str(e)}), 404
    
    # special case: this is the only file. This is effectly purging.
    if len(session["dblist"]) == 1:
        session.clear()
        return redirect("/")

    # delete JSON
    if f"messages_{id}" in session:
        session.pop(f"messages_{id}")
    
    # delete from nicknames
    session["messages_nicknames"].pop(id)
    
    # delete caches (TWO, if exists)
    if f'glossary_{id}' in session:
        session.pop(f'glossary_{id}')
    
    if f'relationships_{id}' in session:
        session.pop(f'relationships_{id}')
    
    # delete from globalglossary
    if id in session['GlobalGlossary']:
        session['GlobalGlossary'].pop(id)

    # delete from dblist
    session["dblist"].remove(id);

    # IF active file, replace active file to the most recent one
    if session["db"] == id:
        session["db"] = session["dblist"][-1]

    return redirect('/listfiles')



# Serve 'engine.js'
@app.route("/engine.js")
def engine():
    return send_from_directory('templates/visualize/download', 'engine.js')

# Serve 'discord-stopword-en.js'
@app.route("/discord-stopword-en.js")
def discord_stopword():
    return send_from_directory('templates/visualize/download', 'discord-stopword-en.js')

# Serve 'textrank.js'
@app.route("/textrank.js")
def textrank():
    return send_from_directory('templates/visualize/download/TextRank', 'textrank.js')

# Serve 'knee_locator.js'
@app.route("/knee_locator.js")
def knee_locator():
    return send_from_directory('templates/visualize/download/TextRank/KneeLocator', 'knee_locator.js')

# Serve 'GroupTheory.js'
@app.route("/GroupTheory.js")
def group_theory():
    return send_from_directory('templates/visualize/download', 'GroupTheory.js')

# Serve 'glossary_compression.js'
@app.route("/glossary_compression.js")
def glossary_compression():
    return send_from_directory('templates/visualize/download', 'glossary_compression.js')

# Serve 'pagerank.js'
@app.route("/pagerank.js")
def engine_page_rank():
    return send_from_directory('templates/visualize/download/TextRank/', 'pagerank.js')

# Serve 'util.js'
@app.route("/util.js")
def util():
    return send_from_directory('templates/visualize/download/TextRank', 'util.js')

# Serve 'Segmentation.js'
@app.route("/Segmentation.js")
def segmentation():
    return send_from_directory('templates/visualize/download/TextRank', 'Segmentation.js')

# Serve 'BrillTransformationRules.js'
@app.route("/BrillTransformationRules.js")
def brill_transformation_rules():
    return send_from_directory('templates/visualize/download/TextRank/POS', 'BrillTransformationRules.js')

# Serve 'index.js'
@app.route("/index.js")
def pos_index():
    return send_from_directory('templates/visualize/download/TextRank/POS', 'index.js')

# Serve 'lexer.js'
@app.route("/lexer.js")
def lexer():
    return send_from_directory('templates/visualize/download/TextRank/POS', 'lexer.js')

# Serve 'lexicon.js'
@app.route("/lexicon.js")
def lexicon():
    return send_from_directory('templates/visualize/download/TextRank/POS', 'lexicon.js')

# Serve 'POSTagger.js'
@app.route("/POSTagger.js")
def pos_tagger():
    return send_from_directory('templates/visualize/download/TextRank/POS', 'POSTagger.js')

#Serve Proprietart Algorithm
@app.route("/ShubhanGPT.js")
def prop_summary():
    return send_from_directory('templates/visualize/download/TextRank/Proprietary', 'ShubhanGPT.js')


# TODO: Move all the above js's into dedicated /js directory







"""
@app.before_request
def load_demo_titles():
    # Check if the flag 'first_request_done' exists in the session
    if 'first_request_done' not in session:
        print(os.getcwd())
        try:
            # Directory containing JSON files
            directory = 'static/demo/glossary'
            demo_titles = {}
            print(os.listdir(directory))
            
            # Iterate through all JSON files in the directory
            for filename in os.listdir(directory):
                if filename.endswith('.json'):
                    filepath = os.path.join(directory, filename)
                    with open(filepath, 'r') as file:
                        # Load JSON content
                        demo_titles[filename] = json.load(file)

            # Store the demo titles in session
            session['DemoTitlesGlossary'] = demo_titles
            session["glossary_exists"] = True
            print(f"Loaded demo titles: {list(demo_titles.keys())}")

            # Set the session flag to indicate the first request has been processed
            session['first_request_done'] = True
            
        except FileNotFoundError:
            print(f"Error: Directory '{directory}' not found.")
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
"""

# helper for live_server_update, puts data into session
@app.route("/savedata", methods=["POST"])
def live_update_save():
    # todo: guard against putting garbage data (or is it okay b/c it's session?)
    # session "messages_<filename>" stores JSON of raw data
    # session "db" stores the JSON of active file
    # session "messages_nicknames" is a dict from filename -> nickname

    # is data being received?
    try:
        if request.json["status"] == "new":
            session["temp_savedata"] = request.json["data"]
            return jsonify({"ok": True})
        elif request.json["status"] == "continued":
            session["temp_savedata"] += request.json["data"]
            return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "reason": "Failed while receiving data", "exception": str(e)})

    try:
        assert(request.json["filename"] != "")
        # put last data
        session["temp_savedata"] += request.json["data"]


        # parse
        session[f"messages_{request.json['filename']}"] = json.loads(session["temp_savedata"])
        session["temp_savedata"] = ""

        session["db"] = request.json["filename"]

        if "dblist" in session:
            session["dblist"].append(str(request.json['filename']))
        else:
            session["dblist"] = [str(request.json['filename'])]

        if "messages_nicknames" not in session: session["messages_nicknames"] = {} #init'ise dict
        if request.json['nickname'] == "":
            # fallback
            session["messages_nicknames"][str(request.json['filename'])] = str(request.json['filename'])
        else:
            session["messages_nicknames"][str(request.json['filename'])] = str(request.json['nickname'])

        session.modified = True
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "reason": "Error while finalising the process", "exception": str(e)}), 500

DATA_DIRECTORY = 'static/demo/messages'


@app.route('/messages/<filename>', methods=['GET'])
def get_file_data(filename):
    """
    Serve the content of a conversation JSON file saved to session.
    DO NOT USE WITH VERCEL (PAYLOAD WILL BE TOO LARGE)
    """
    try:
        # ATTEMPT TO FIND IT FROM SESSION
        if f"messages_{filename}" in session:
            return jsonify(session[f"messages_{filename}"])

        else:
            return jsonify({"error": f"File {filename} not found"}), 404
    except Exception as e:
        return jsonify({"error": f"File {filename} not found"}), 404

@app.route('/messagespt/<filename>', methods=['GET'])
def get_file_data_fromto(filename):
    """
    Serve the content of a conversation JSON file saved to session, but only substring [from, min(to, len)).
    CAN BE USED WITH VERCEL
    """
    messagesSTR = ""
    try:
        # ATTEMPT TO FIND IT FROM SESSION
        if f"messages_{filename}" in session:
            if 'from' not in request.args or 'to' not in request.args:
                return jsonify({"error": f"From or to argument not found."}), 500
            messagesSTR = json.dumps(session[f"messages_{filename}"])

        else:
            return jsonify({"error": f"File {filename} not found"}), 404
    except Exception as e:
        return jsonify({"error": f"File {filename} not found"}), 404
    
    try:
        end = len(messagesSTR) <= int(request.args.get('to'))

        # compute indicies
        substrBgn = int(request.args.get('from'))
        substrEnd = min(int(request.args.get('to')), len(messagesSTR))

        return jsonify({
            "end": end,
            "data": messagesSTR[substrBgn:substrEnd]
        })
    except Exception as e:
        return jsonify({"error": f"INTERNAL SERVER ERROR"}), 500

@app.route('/saveglobalkeywordglossary', methods=['POST'])
def save_global_glossary():
    try:
        data = request.get_json()
        filename = data.get('filename')
        glossary = data.get('glossary')

        if not filename or not glossary:
            return jsonify({"error": "Filename and glossary are required!"}), 400

        # Store glossary in session
        if 'GlobalGlossary' not in session:
            session['GlobalGlossary'] = {}

        session['GlobalGlossary'].update({filename: glossary})
        session.modified = True  # Ensure session changes are saved

        return jsonify({"message": f"Glossary for {filename} saved successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/saveglossary', methods=['POST'])
def save_glossary():
    try:
        data = request.get_json()
        filename = data.get('filename')
        glossary = data.get('glossary')

        print("Glossary",glossary.keys(),'\n',filename,'\n\n')
        if not filename or not glossary:
            return jsonify({"error": "Filename and glossary are required!"}), 400

        # Store glossary in session
        session[f'glossary_{filename}'] = glossary
        session.modified = True  # Ensure session changes are saved
        return jsonify({"message": f"Glossary for {filename} saved successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/saverelationships', methods=['POST'])
def save_relationships():
    try:
        data = request.get_json()
        filename = data.get('filename')
        relationships = data.get('hierarchicalRelationships')

        print("Relationships",relationships.keys(),'\n',filename,'\n\n')
        if not filename or not relationships:
            return jsonify({"error": "Filename and hierarchical relationships are required!"}), 400

        # Store relationships in session
        session[f'relationships_{filename}'] = relationships
        session.modified = True  # Ensure session changes are saved
        return jsonify({"message": f"Hierarchical relationships for {filename} saved successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/saveactivefile', methods=['POST'])
def save_activefile():
    try:
        session["db"] = request.get_json().get("fileid");
    except Exception as e:
        return jsonify({"error": str(e)}), 404 # means no argument presented
    
@app.route('/saveactivefile', methods=['GET'])
def save_activefileGET():
    # this is auxiliary to /listfiles. Redirects back to /listfiles. May add an argument in the future if used somewhere else.
    try:
        session["db"] = request.args.get("fileid");
        return redirect("/listfiles")
    except Exception as e:
        return jsonify({"error": str(e)}), 404 # means no argument presented



@app.route('/getglobalglossary', methods=['GET'])
def get_global_glossary():
    try:
        # Assuming the glossary is stored in session['GlobalGlossary']
        return jsonify(session.get('GlobalGlossary', {})), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Route to get demo titles
@app.route('/getDemoTitles', methods=['GET'])
def get_demo_titles():
    try:
        return jsonify(session.get('DemoTitlesGlossary', {})), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/getglossary/<filename>', methods=['GET'])
def get_glossary(filename):
    glossary = session.get(f'glossary_{filename}', None)
    if glossary:
        return jsonify({"glossary": glossary}), 200
    return jsonify({}), 404

@app.route('/getrelationships/<filename>', methods=['GET'])
def get_relationships(filename):
    relationships = session.get(f'relationships_{filename}', None)
    if relationships:
        return jsonify({"hierarchicalRelationships": relationships}), 200
    return jsonify({}), 404


@app.route('/purgefiles', methods=['GET'])
def purge():
    # PURGE ALL FILES. ONLY CALL WITH DOUBLE CHECK!!!
    session.clear()
    return redirect("/")










@app.route("/stopword")
def jsstopword():
    print("Called here")
    return send_from_directory('templates/visualize/download', 'discord-stopword-en.js')



@app.route('/storyboard')
def storyboard():
    return render_template('storyboard/storyboard.html', group='story')

@app.route('/content')
def content():
    return render_template('content/content.html', group='content')

@app.route('/character')
def character():
    return render_template('character/content.html', group='char')

@app.route('/about')
def aboutrt():
    return jsonify({"version": "20250224a"}), 200



# helper functions to determine what to show as active db file. For use in main.html.
def determineDBId():
    if "db" not in session: return ""
    return session["db"]

def determineDBName():
    if "db" not in session: return ""
    if "messages_nicknames" not in session or session["db"] not in session["messages_nicknames"]: return session["db"]
    return session["messages_nicknames"][session["db"]]

app.jinja_env.globals.update(determineDBId=determineDBId)
app.jinja_env.globals.update(determineDBName=determineDBName)

print("Yes we are running your app.py")


if __name__ == '__main__':
    app.run(host="0.0.0.0")
