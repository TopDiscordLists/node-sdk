import type { ClientOptions, Listing, VoteCheck, VotesResponse, BotStats, Analytics, WebhookPayload } from "../utils/typings.js";
import type { RequestHandler } from "express";
export declare class Client {
    private readonly token;
    private readonly apiUrl;
    constructor(options: ClientOptions);
    private request;
    /**
     * Get the listing associated with this token.
     */
    getListing(): Promise<Listing>;
    /**
     * Check whether a Discord user has voted
     * within the current voting cooldown.
     */
    hasVoted(discordId: string): Promise<VoteCheck>;
    /**
     * Get recent votes for the listing.
     */
    getVotes(limit?: number, page?: number): Promise<VotesResponse>;
    /**
     * Get analytics for the listing.
     *
     * @param days Number of days to retrieve (1-90).
     */
    getAnalytics(days?: number): Promise<Analytics>;
    /**
     * Post bot statistics to TopDiscordList.
     */
    postStats(stats: BotStats): Promise<void>;
    /**
     * Verify a TopDiscordList webhook signature.
     *
     * The raw request body must be provided before JSON parsing.
     */
    static verifyWebhook(signature: string, rawBody: string | Buffer, token: string): boolean;
    expressWebhook(handler: (payload: WebhookPayload) => Promise<void> | void): RequestHandler;
}
