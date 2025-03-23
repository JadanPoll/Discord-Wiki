import pako from 'pako'

/**
 * This client is mainly for fetching channels.
 * Nathan:
 * I changed the code so that instead of referring to specific function
 * from afterDataDecompressed, we pass a callback function at construction.
 * This allows us better encapsulation.
 * 
 * + for god's sake ensure that pako 1.0.0 is installed. I had to learn this in the hard way...
 */

export class DiscordClient {
    constructor(wsUrl, token, callback) {
        // wsUrl: Discord WebSocket URL.
        // token: Discord token to use.
        // callback(data): Callback function to execute after all data is received.
        this.wsUrl = wsUrl;
        this.token = token;
        this.ws = null;
        this.seq = null;
        this.heartbeatInterval = null;
        this.inflater = new pako.Inflate({ chunkSize: 65536, to: 'string' });
        this.inflater.onEnd = this.afterDataDecompressed.bind(this);
        this.callback = callback;
        this.result = null;
    }

    connect() {
        this.ws = new WebSocket(this.wsUrl);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => { console.log('WebSocket connected.'); this.sayHello(); }
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
            if (this.result.t == "READY") {
                // Call the callback as defined in the constructor.
                this.callback(this.result);
            }
            this.seq = this.result.s || this.seq;
            this.inflater.chunks = [];
        } else {
            console.log('Inflation failed.');
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