import os
import subprocess
import hmac
import hashlib
from flask import Flask, request, jsonify, send_file, abort,render_template
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
                
            # Refresh the application
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

        response = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            data=request.get_data(),
            params=request.args
        )

        return (response.content, response.status_code, response.headers.items())
    except requests.RequestException as e:
        print("Error forwarding request:", e)
        return jsonify({"error": str(e)}), 500




@app.route("/")
def main():
    return render_template('frontpage.html')

@app.route('/visualize')
def visualize():
    return render_template('visualize/index.html', group='dev')

@app.route("/visualize/download_messages")
def dl_msg():
    return render_template('visualize/download/download_messages.html', group='dev')

@app.route("/visualize/live_server_update")
def live_update():
    return render_template('visualize/download/live_server_update.html', group='dev')

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
if __name__ == "__main__":
    print("Nathan Hello WOrld")
    app.run(host='0.0.0.0', port=3000)  # Use 3000 or the port specified by your host
