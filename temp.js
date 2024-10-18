(() => {
    const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.0/pako.js';
    const WS_URL = 'wss://gateway.discord.gg/?encoding=json&v=9&compress=zlib-stream';
    const DISCORD_TOKEN = 'YOUR_DISCORD_TOKEN'; // Replace with your actual token

    // Asynchronously load external script
    const loadScript = async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load script: ${response.statusText}`);
            const scriptElement = document.createElement('script');
            scriptElement.textContent = await response.text();
            document.head.appendChild(scriptElement);
            console.log('Script loaded successfully.');
        } catch (error) {
            console.error('Error loading script:', error);
        }
    };

    // Handles WebSocket and compression logic
    class DiscordClient {
        constructor(wsUrl, token) {
            this.wsUrl = wsUrl;
            this.token = token;
            this.ws = null;
            this.seq = null;
            this.heartbeatInterval = null;
            this.inflater = new pako.Inflate({ chunkSize: 65536, to: 'string' });
            this.inflater.onEnd = this.afterDataDecompressed.bind(this);
            this.result = null;
        }

        connect() {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.binaryType = 'arraybuffer';
            this.ws.onopen = () => {console.log('WebSocket connected.'); this.sayHello()}
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = () => console.log('WebSocket closed.');
        }

        handleMessage(event) {
            if (event.data instanceof ArrayBuffer) {
                this.inflater.push(new Uint8Array(event.data), pako.Z_SYNC_FLUSH);
            }
            if (!this.heartbeatInterval && this.result) {

                this.startHeartbeat();
            }
        }

        afterDataDecompressed(status) {
            if (status === 0) {
                this.result = JSON.parse(this.inflater.chunks.join(''));
                console.log('Received:', this.result);
                this.seq = this.result.s || this.seq;
                this.inflater.chunks = [];
            } else {
                console.error('Inflation failed.');
            }
        }

        sayHello() {
            this.send({
                op: 2,
                d: {
                    token: this.token,
                    properties: { os: "Windows", browser: "Chrome", device: "" },
                    compress: false,
                    capabilities: 30717,
                    presence: { status: "online", afk: false }
                }
            });
        }

        startHeartbeat() {
            const heartbeatInterval = this.result.d?.heartbeat_interval || 5000;
            this.heartbeatInterval = setInterval(() => {
                this.send({ op: 1, d: this.seq });
                console.log('Heartbeat sent.');
            }, heartbeatInterval);
        }

        send(payload) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(payload));
            }
        }
    }

    // Initialize WebSocket after loading Pako.js
    loadScript(SCRIPT_URL).then(() => {
        const client = new DiscordClient(WS_URL, DISCORD_TOKEN);
        client.connect();
    });
})();
