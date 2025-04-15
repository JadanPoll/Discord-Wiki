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






# ----------------------------------------------------------------
# Global Data Store for NFC Sessions
# ----------------------------------------------------------------
# Each key is a unique NFC code mapping to a dictionary:
# { "title": <str>, "host_device": <str>, "created_at": <ISO timestamp>, "notified": <bool> }
nfc_sessions = {}


# ----------------------------------------------------------------
# Helper Functions
# ----------------------------------------------------------------
def create_unique_nfc_code():
    """Generate a random unique 5-digit NFC code as a string."""
    return str(random.randint(1000, 9999))


def get_or_create_device_identifier():
    """
    Retrieve or generate a unique identifier for this device (stored in the session).
    This identifier is used to manage NFC sessions for this client.
    """
    if "device_id" not in session:
        session["device_id"] = str(uuid.uuid4())
    return session["device_id"]


# ----------------------------------------------------------------
# Connection Handlers
# ----------------------------------------------------------------
@socketio.on('connect')
def handle_client_connect():
    print("Activating connect")
    device_identifier = get_or_create_device_identifier()
    # Use the Socket.IO session id for room management.
    join_room(request.sid)
    print(f"Device connected: Session ID {request.sid} (Device Identifier: {device_identifier}).")


@socketio.on('disconnect')
def handle_client_disconnect():
    print("Deactivating disconnect")
    print(f"Device with Session ID {request.sid} disconnected.")


# ----------------------------------------------------------------
# NFC Session Endpoints
# ----------------------------------------------------------------
@socketio.on('nfc_create_nfc_link_to_this_dserver')
def initiate_nfc_session(data):
    """
    Expects data containing a "title" (for example, a title or identifier for the NFC session).
    Generates a new NFC code, saves the session data, and sends the generated code
    back to the host device.
    """
    title = data.get("title")
    host_device = request.sid  # Use the Socket.IO session id as the host identifier.
    nfc_code = create_unique_nfc_code()
    nfc_sessions[nfc_code] = {
        "title": title,
        "host_device": host_device,
        "created_at": datetime.datetime.utcnow().isoformat(),
        "notified": False
    }
    print(f"NFC session initiated: Code {nfc_code} for device {host_device} with title '{title}'.")
    emit('nfc_success_created_code_for_dserver', {"nfc_code": nfc_code}, room=host_device)


@socketio.on('nfc_request_dserver_from_host_device')
def process_nfc_share_request(data):
    """
    Expects data with a "nfc_code" field.
    When a remote device requests to share NFC data, find the corresponding session and
    notify the host device by emitting 'nfc_session_matched' with details about the request.
    """
    nfc_code = data.get("nfc_code")
    if nfc_code in nfc_sessions:
        host_device = nfc_sessions[nfc_code]["host_device"]

        if host_device == request.sid:
            emit('nfc_request_dserver_from_host_device.error', {"error": "Requesting device is same as host device"}, room=request.sid)
            return
        
        print(f"NFC share request received for code {nfc_code} from device {request.sid}.")
        # Notify the host device that a share request has been received.
        emit('nfc_request_made_for_host_dserver', {
            "title": nfc_sessions[nfc_code]["title"],
            "nfc_code": nfc_code,
            "requesting_device": request.sid
        }, room=host_device)
        nfc_sessions[nfc_code]["notified"] = True
        # Optionally, also send a basic confirmation response to the requesting device.
        emit('nfc_found_nfc_code_in_dserver_listing', {
            "title": nfc_sessions[nfc_code]["title"],
            "created_at": nfc_sessions[nfc_code]["created_at"]
        }, room=request.sid)
    else:
        print(f"Share request for unknown NFC code {nfc_code} received from device {request.sid}.")
        emit('nfc_request_dserver_from_host_device.error', {"error": "NFC code not found"}, room=request.sid)


@socketio.on('nfc_share_dserver_to_requesting_device')
def share_nfc_session_data(data):
    """
    Expects data with:
      - "nfc_code": The NFC code identifying the session.
      - "requesting_device": The Socket.IO ID of the device which originally requested the session.
      - Additional fields: "relationships", "summary", "conversation_blocks", "glossary".
      
    Forwards the shared data from the host to the requesting device.
    """
    nfc_code = data.get("nfc_code")
    if nfc_code in nfc_sessions:
        requesting_device = data.get("requesting_device")
        payload = {
            "id" : data.get("id"),
            "nickname": data.get("nickname"),
            "relationships": data.get("relationships"),
            "summary": data.get("summary"),
            "conversation_blocks": data.get("conversation_blocks"),
            "glossary": data.get("glossary")
        }
        print(f"Forwarding NFC session data for code {nfc_code} to requesting device {requesting_device}.")
        emit('nfc_host_is_sharing_requested_data', payload, room=requesting_device)
        nfc_sessions[nfc_code]["notified"] = True
    else:
        print(f"Attempted to share data for unknown NFC code {nfc_code} by device {request.sid}.")
        emit('nfc_error', {"error": f"NFC code not found for sharing data {nfc_code} {nfc_sessions}"}, room=request.sid)


@socketio.on('nfc_clear_all_dservers_nfcs')
def clear_nfc_sessions():
    """
    Clears all NFC sessions associated with the current device.
    This can be used when a device disconnects or wants to reset its NFC sessions.
    """
    current_device = request.sid
    codes_to_remove = [code for code, session_info in nfc_sessions.items() if session_info["host_device"] == current_device]
    for code in codes_to_remove:
        del nfc_sessions[code]
    print(f"Cleared NFC sessions for device {current_device}: {codes_to_remove}")
    emit('nfc_all_dservers_cleared', {"cleared_nfc_codes": codes_to_remove}, room=current_device)













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
