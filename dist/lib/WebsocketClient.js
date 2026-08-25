import WebSocket from "ws";
export class WebSocketClient {
    socket = null;
    token;
    url;
    voteListeners = [];
    readyListeners = [];
    constructor(token, url) {
        this.token = token;
        this.url = url;
    }
    connect() {
        if (this.socket) {
            return;
        }
        this.socket = new WebSocket(this.url, {
            headers: {
                Authorization: `Bot ${this.token}`
            }
        });
        this.socket.on("open", () => {
            console.log("Connected to TopDiscordList WebSocket");
        });
        this.socket.on("message", (data) => {
            this.handleMessage(data.toString());
        });
        this.socket.on("close", () => {
            console.log("Disconnected from TopDiscordList WebSocket");
            this.socket = null;
        });
        this.socket.on("error", (error) => {
            console.error("TopDiscordList WebSocket error:", error);
        });
    }
    disconnect() {
        if (!this.socket) {
            return;
        }
        this.socket.close();
        this.socket = null;
    }
    on(event, listener) {
        if (event === "vote") {
            this.voteListeners.push(listener);
        }
        if (event === "ready") {
            this.readyListeners.push(listener);
        }
    }
    ping() {
        if (this.socket?.readyState !== WebSocket.OPEN) {
            return;
        }
        this.socket.send("ping");
    }
    handleMessage(data) {
        let event;
        try {
            event = JSON.parse(data);
        }
        catch {
            console.error("Received invalid WebSocket message:", data);
            return;
        }
        switch (event.type) {
            case "ready":
                this.handleReady(event);
                break;
            case "vote":
                this.handleVote(event);
                break;
            case "pong":
                break;
        }
    }
    handleReady(event) {
        for (const listener of this.readyListeners) {
            listener(event);
        }
    }
    handleVote(event) {
        for (const listener of this.voteListeners) {
            listener(event);
        }
    }
}
