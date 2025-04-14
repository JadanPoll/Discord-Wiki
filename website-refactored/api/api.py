import os
import subprocess
import hmac
import hashlib
import uuid
import datetime
import random
import requests

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
# Print startup info
print("Run website on http://127.0.0.1:3000")

# Initialize Flask app with SocketIO
app = Flask(__name__, static_folder="demo")
app.secret_key = "DSearchPokémon"  # Replace with a secure value in production
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")  # enable cross-origin for SocketIO

# Configuration variables
GIT_SCRIPT = "../../git.sh"  # Adjust path as necessary
PORT = 5000
SECRET = os.getenv('SECRET')  # GitHub webhook secret from environment variables

# Global dictionary to store NFC communication data.
# Each key is a unique NFC code mapping to a dictionary:
# { "title": <str>, "device_id": <str>, "added_at": <ISO timestamp>, "notified": <bool> }
nfc_data = {}

def generate_nfc_code():
    """Generate a random unique 5-digit NFC code as a string."""
    return str(random.randint(10000, 99999))

def get_device_id():
    """
    Retrieve or generate a unique identifier for this device (stored in the session).
    This ID is used to scope NFC data for add/clear operations.
    """
    if "device_id" not in session:
        session["device_id"] = str(uuid.uuid4())
    return session["device_id"]

# ----------------------------
# SocketIO Event Handlers
# ----------------------------
@socketio.on('connect')
def on_connect():
    device_id = get_device_id()
    join_room(device_id)
    print(f"Device {device_id} connected via SocketIO.")

@socketio.on('disconnect')
def on_disconnect():
    print("A client disconnected.")

# ----------------------------
# GitHub Webhook Endpoint
# ----------------------------
@app.route('/git', methods=['POST'])
def on_webhook():
    print("Webhook activated")
    
    # Validate the GitHub webhook signature
    signature = 'sha1=' + hmac.new(SECRET.encode(), request.data, hashlib.sha1).hexdigest()
    if (request.headers.get("X-GitHub-Event") == "push" and
            signature == request.headers.get("X-Hub-Signature")):
        print("Processing push event...")
        try:
            # Ensure the git script is executable
            subprocess.check_call(f"chmod +x {GIT_SCRIPT}", shell=True)
            print("Permissions changed for git.sh")
            
            # Execute the git script if it exists
            if os.path.exists(GIT_SCRIPT):
                print(f"{GIT_SCRIPT} found, executing...")
                subprocess.check_call(GIT_SCRIPT, shell=True)
            else:
                print(f"{GIT_SCRIPT} does not exist")
                
            # Optionally refresh the application if needed
            subprocess.call("refresh", shell=True)
        except subprocess.CalledProcessError as e:
            print(f"Error in webhook processing: {e}")
    return '', 200

# ----------------------------
# CORS Bypass Proxy Endpoint
# ----------------------------
@app.route('/cors-bypass/<path:target_url>', methods=["GET", "POST", "PUT", "DELETE"])
def cors_bypass(target_url):
    try:
        auth_header = request.headers.get("Authorization")
        headers = {"Authorization": auth_header} if auth_header else {}
        response = requests.request(
            method=request.method,
            url=f"{target_url}?{request.query_string.decode('utf-8')}",
            headers=headers,
            data=request.get_data()
        )
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            return jsonify(response.json()), response.status_code
        else:
            return jsonify({"error": "Response is not JSON", "content": response.text}), response.status_code
    except requests.RequestException as e:
        print("Error forwarding request:", e)
        return jsonify({"error": str(e)}), 500

# ----------------------------
# NFC Communication Endpoints
# ----------------------------
@socketio.on('add_nfc_code')
def handle_add_nfc_code(data):
    title = data.get("title")
    device_id = request.sid  # Use session/socket ID
    code = generate_nfc_code()
    nfc_data[code] = {
        "title": title,
        "device_id": device_id,
        "added_at": datetime.datetime.utcnow().isoformat(),
        "notified": False
    }
    emit('nfc_code_created', {"code": code}, room=device_id)

@socketio.on('request_nfc_code')
def handle_request_nfc_code(data):
    code = data.get("code")
    if code in nfc_data:
        target_id = nfc_data[code]["device_id"]
        emit('nfc_code_matched', {
            "title": nfc_data[code]["title"],
            "code": code
        }, room=target_id)
        nfc_data[code]["notified"] = True
        emit('nfc_response', {
            "title": nfc_data[code]["title"],
            "added_at": nfc_data[code]["added_at"]
        })
    else:
        emit('nfc_error', {"error": "Code not found"})

@socketio.on('clear_nfc_codes')
def handle_clear_nfc_codes():
    device_id = request.sid
    codes_to_clear = [code for code, data in nfc_data.items() if data['device_id'] == device_id]
    for code in codes_to_clear:
        del nfc_data[code]
    emit('nfc_cleared', {"cleared_codes": codes_to_clear})
