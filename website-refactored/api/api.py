import os
import subprocess
import hmac
import hashlib
from flask import Flask, request, jsonify, send_file, abort,render_template, send_from_directory, session
from flask_cors import CORS
import requests
import datetime
import random


print(f"Run website on http://127.0.0.1:3000")
# Init'ise API server
app = Flask(__name__)
app.secret_key = "DSearchPokémon"
CORS(app)

# Define configuration variables
GIT_SCRIPT = "../../git.sh" # TODO is this correct???
PORT = 5000
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
# TODO guard this route so that ppl don't use this as free proxy
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