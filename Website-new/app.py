import os
import subprocess
import hmac
import hashlib
from flask import Flask, request, jsonify, send_file, abort,render_template, send_from_directory
from flask_cors import CORS
import requests
app = Flask(__name__, template_folder='templates', static_url_path='/', static_folder='static')

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
    return render_template('visualize/download/forzapagerank.html', group='dev')

@app.route("/rankengine")
def jspagerank():
    print("Called here")
    return send_from_directory('templates/visualize/download', 'engine.js')

@app.route("/stopword")
def jspagerank():
    print("Called here2")
    return send_from_directory('templates/visualize/download', 'discord-stopword-en.js')



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

print("Yes we are running your app.py")


if __name__ == '__main__':
    app.run()
