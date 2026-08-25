import type { VoteListener, ReadyListener } from "../utils/typings.js";
export declare class WebSocketClient {
    private socket;
    private readonly token;
    private readonly url;
    private readonly voteListeners;
    private readonly readyListeners;
    constructor(token: string, url: string);
    connect(): void;
    disconnect(): void;
    on(event: "vote", listener: VoteListener): void;
    on(event: "ready", listener: ReadyListener): void;
    ping(): void;
    private handleMessage;
    private handleReady;
    private handleVote;
}
//# sourceMappingURL=WebSocketClient.d.ts.map