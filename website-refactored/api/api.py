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

# For dev in gunicorn
import sys
sys.stdout.flush()

# Print startup info
print("Run Nwebsite on http://127.0.0.1:3000")

# Initialize Flask app with SocketIO
app = Flask(__name__)
app.secret_key = "DSearchPokémon"  # Replace with a secure value in production
CORS(app)

if os.environ.get("FLASK_ENV") == "development":
    # Development configuration
    socketio = SocketIO(app, cors_allowed_origins="*")
else:
    # Production configuration
    socketio = SocketIO(app, async_mode="eventlet", cors_allowed_origins="*")
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
# ... keep imports and globals unchanged

@socketio.on('nfc_create_nfc_link_to_this_dserver')
def initiate_nfc_session(data):
    title = data.get("title")
    dserver_id = data.get("id")  # client must send this
    host_device = request.sid
    nfc_code = create_unique_nfc_code()

    nfc_sessions[nfc_code] = {
        "title": title,
        "host_device": host_device,
        "created_at": datetime.datetime.utcnow().isoformat(),
        "notified": False,
        "dserver_id": dserver_id
    }

    print(f"NFC session initiated: Code {nfc_code} for device {host_device} with title '{title}' (id: {dserver_id}).")
    emit(f'nfc_success_created_code_for_dserver:{dserver_id}', {"nfc_code": nfc_code}, room=host_device)


@socketio.on('nfc_request_dserver_from_host_device')
def process_nfc_share_request(data):
    nfc_code = data.get("nfc_code")
    dserver_id = None

    if nfc_code in nfc_sessions:
        session_info = nfc_sessions[nfc_code]
        host_device = session_info["host_device"]
        dserver_id = session_info.get("dserver_id", "unknown")

        if host_device == request.sid:
            emit(f'nfc_error:{dserver_id}', {"error": "Requesting device is same as host device"}, room=request.sid)
            return

        print(f"NFC share request for code {nfc_code} from device {request.sid}.")
        emit(f'nfc_request_made_for_host_dserver:{dserver_id}', {
            "title": session_info["title"],
            "nfc_code": nfc_code,
            "requesting_device": request.sid
        }, room=host_device)

        emit('nfc_found_nfc_code_in_dserver_listing', {
            "title": session_info["title"],
            "created_at": session_info["created_at"]
        }, room=request.sid)

        session_info["notified"] = True
    else:
        print(f"Unknown NFC code {nfc_code} from device {request.sid}.")
        emit('nfc_request_dserver_from_host_device.error', {"error": "NFC code not found."}, room=request.sid)


@socketio.on('nfc_share_dserver_to_requesting_device')
def share_nfc_session_data(data):
    nfc_code = data.get("nfc_code")
    dserver_id = data.get("id")  # required for namespacing

    if nfc_code in nfc_sessions:
        requesting_device = data.get("requesting_device")
        payload = {
            "id": dserver_id,
            "imageUrl": data.get("imageUrl"),
            "nickname": data.get("nickname"),
            "relationships": data.get("relationships"),
            "summary": data.get("summary"),
            "conversation_blocks": data.get("conversation_blocks"),
            "glossary": data.get("glossary")
        }

        print(f"Sharing NFC session {nfc_code} with requesting device {requesting_device} for id {dserver_id}.")
        emit('nfc_host_is_sharing_requested_data', payload, room=requesting_device)
        nfc_sessions[nfc_code]["notified"] = True
    else:
        print(f"Invalid NFC code {nfc_code} when sharing from host {request.sid}.")
        emit(f'nfc_error:{dserver_id}', {"error": f"NFC code not found for sharing: {nfc_code}"}, room=request.sid)


@socketio.on('nfc_clear_all_dservers_nfcs')
def clear_nfc_sessions():
    current_device = request.sid
    codes_to_remove = [
        code for code, session_info in nfc_sessions.items()
        if session_info["host_device"] == current_device
    ]
    ids_cleared = [nfc_sessions[code]["dserver_id"] for code in codes_to_remove if "dserver_id" in nfc_sessions[code]]

    for code in codes_to_remove:
        del nfc_sessions[code]

    print(f"Cleared NFC sessions for device {current_device}: {codes_to_remove}")
    for dserver_id in ids_cleared:
        emit(f'nfc_all_dservers_cleared:{dserver_id}', {"cleared_nfc_codes": codes_to_remove}, room=current_device)













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

@app.route('/test-endpoint', methods=['GET'])
def test_endpoint():
    print("Test endpoint hit")
    return jsonify({"status": "ok", "message": "Flask Proxy test endpoint working"}), 200


@app.route('/API')
def home():
    return jsonify({"status": "ok", "message": "Default API route working"}), 200

