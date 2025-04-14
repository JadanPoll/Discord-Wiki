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

@app.route('/nfc-communication-add', methods=['POST'])
def nfc_add():
    """
    Add NFC communication data.
    Expected JSON body:
    {
        "title": "LocalStorageTitleOrIdentifier"
    }
    The server creates a unique 5-digit code and associates it with the requesting device.
    """
    req_data = request.get_json()
    if not req_data or "title" not in req_data:
        return jsonify({"error": "Missing 'title' in request data"}), 400

    title = req_data["title"]
    code = generate_nfc_code()
    device_id = get_device_id()
    nfc_data[code] = {
        "title": title,
        "device_id": device_id,
        "added_at": datetime.datetime.utcnow().isoformat(),
        "notified": False
    }
    print(f"Device {device_id}: NFC code added: {code} for title '{title}'")
    return jsonify({"code": code}), 200

@app.route('/nfc-communication-request', methods=['POST'])
def nfc_request():
    """
    Request NFC communication.
    Expected JSON body:
    {
        "code": "12345"
    }
    This endpoint is global. If the provided code exists, the associated data is returned and
    a SocketIO notification is sent to the device that originally added the NFC code.
    """
    req_data = request.get_json()
    if not req_data or "code" not in req_data:
        return jsonify({"error": "Missing 'code' in request data"}), 400

    code = req_data["code"]
    if code in nfc_data:
        data = nfc_data[code]
        # Mark as notified and notify the original device via SocketIO
        nfc_data[code]["notified"] = True
        original_device = data["device_id"]
        notification_payload = {
            "code": code,
            "title": data["title"],
            "added_at": data["added_at"]
        }
        print(f"NFC request: Notifying device {original_device} for code: {code}")
        socketio.emit("nfc_notification", notification_payload, room=original_device)
        return jsonify({
            "notification": "nfc-communication-notify",
            "title": data["title"],
            "added_at": data["added_at"]
        }), 200
    else:
        print(f"NFC request: Code not found: {code}")
        return jsonify({"error": "Code not found"}), 404

@app.route('/nfc-communication-clear', methods=['POST'])
def nfc_clear():
    """
    Clear all NFC communication codes for the current device.
    Only codes created by this device (as determined by session device_id) will be cleared.
    """
    device_id = get_device_id()
    cleared_codes = [code for code, data in nfc_data.items() if data.get("device_id") == device_id]
    for code in cleared_codes:
        del nfc_data[code]
    print(f"Device {device_id}: Cleared codes: {cleared_codes}")
    return jsonify({"status": "cleared", "cleared_codes": cleared_codes}), 200

# ----------------------------
# Run the Flask app with SocketIO
# ----------------------------
if __name__ == '__main__':
    socketio.run(app, port=PORT)
