
const caesarShift = (str, shift) => {
    return str
        .split('')
        .map(char => {
            const code = char.charCodeAt(0);
            if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
                let shiftedCode = code + shift;
                if ((code >= 65 && code <= 90 && shiftedCode > 90) || (code >= 97 && code <= 122 && shiftedCode > 122)) {
                    shiftedCode -= 26;
                } else if ((code >= 65 && code <= 90 && shiftedCode < 65) || (code >= 97 && code <= 122 && shiftedCode < 97)) {
                    shiftedCode += 26;
                }
                return String.fromCharCode(shiftedCode);
            }
            return char;
        })
        .join('');
};

class WebSocketAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.clientId = null;
        this.isConnected = false;
        this.messageHandlers = new Set(); // Store callback functions

        this.connect();
    }

    async connect() {
        try {
            const response = await fetch(`${this.baseUrl}/connect`);
            if (!response.ok) {
                throw new Error('Failed to connect to server.');
            }

            const { clientId } = await response.json();
            this.clientId = clientId;
            this.isConnected = true;

            this.startPolling();
        } catch (error) {
            console.error('Connection error:', error);
            this.retryConnection();
        }
    }

    async startPolling() {
        while (this.isConnected) {
            try {
                const response = await fetch(`${this.baseUrl}/poll?clientId=${this.clientId}`);
                if (!response.ok) {
                    throw new Error('Polling error.');
                }

                const { message } = await response.json();
                this.handleMessage(message);
            } catch (error) {
                console.error('Polling error:', error);
                this.retryConnection();
                break;
            }
        }
    }

    async aiSendMessage(message) {
        try {
            if (!this.isConnected) {
                throw new Error('Not connected to server.');
            }

            const response = await fetch(`${this.baseUrl}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.clientId, message })
            });

            if (!response.ok) {
                throw new Error('Failed to send message.');
            }
        } catch (error) {
            console.error('Send error:', error);
        }
    }

    handleMessage(message) {
        for (const handler of this.messageHandlers) {
            handler(message); // Call each registered handler with the message
        }
    }

    registerMessageHandler(callback) {
        if (typeof callback === 'function') {
            this.messageHandlers.add(callback);
        } else {
            console.error('Handler must be a function.');
        }
    }

    removeMessageHandler(callback) {
        this.messageHandlers.delete(callback);
    }

    retryConnection() {
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000); // Retry connection after 5 seconds
    }

    sendMessage(type, data) {
        if (!apiInstance) {
            console.error('WebSocketAPI is not initialized.');
            return;
        }
    

        console.log('Data size:', data.length || JSON.stringify(data).length);
        const message = JSON.stringify( { type: type, data: caesarShift(data,7) } );
        apiInstance.aiSendMessage(message);
    }
    
    registerHandler(callback) {
        if (!apiInstance) {
            console.error('WebSocketAPI is not initialized.');
            return;
        }
    
        apiInstance.registerMessageHandler(callback);
    }
    
}

// Exported functions
let apiInstance = null;

function initializeAPI(baseUrl) {
    if (!apiInstance) {
        apiInstance = new WebSocketAPI(baseUrl);
    }
    return apiInstance;
}


// Example usage
/*
document.addEventListener('DOMContentLoaded', () => {
    const serverUrl = 'https://ninth-swamp-orangutan.glitch.me'; // WebSocket server URL
    const api = initializeAPI(serverUrl);

    // Register a custom message handler
    registerHandler((message) => {
        console.log('Custom handler received:', message);
    });

    // Attach sendMessage to a button
    document.getElementById('sendButton').addEventListener('click', () => {
        const input = document.getElementById('dataInput');
        const inputData = input.value.trim();
        if (inputData) {
            sendMessage('yourMessageType', inputData);
        }
    });
});
*/
export {  initializeAPI };
