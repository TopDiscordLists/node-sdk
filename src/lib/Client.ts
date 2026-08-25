import type {
    ClientOptions,
    Listing,
    VoteCheck,
    VotesResponse,
    BotStats,
    Analytics,
    WebhookPayload
} from "../utils/typings.js";

import { APIError } from "../utils/errors.js";
import crypto from "crypto";
import type { RequestHandler } from "express";

const API_VERSION = "v1";
const DEFAULT_API_URL = "https://topdiscordlist.pages.dev/api";

export class Client {
    private readonly token: string;
    private readonly apiUrl: string;

    constructor(options: ClientOptions) {
        this.token = options.token;

        this.apiUrl =
            options.apiUrl ??
            `${DEFAULT_API_URL}/${API_VERSION}`;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(
            `${this.apiUrl}${endpoint}`,
            {
                ...options,
                headers: {
                    Authorization: `Bot ${this.token}`,
                    ...options.headers
                }
            }
        );

        const text = await response.text();

        if (!response.ok) {
            let errorMessage = "An unknown API error occurred.";

            if (text) {
                try {
                    const data = JSON.parse(text) as {
                        error?: string;
                    };

                    errorMessage =
                        data.error ?? errorMessage;
                } catch {
                    // Response wasn't valid JSON.
                }
            }

            throw new APIError(
                errorMessage,
                response.status
            );
        }

        if (!text) {
            return undefined as T;
        }

        return JSON.parse(text) as T;
    }

    /**
     * Get the listing associated with this token.
     */
    public async getListing(): Promise<Listing> {
        const data = await this.request<{
            listing: Listing;
        }>("/listing");

        return data.listing;
    }

    /**
     * Check whether a Discord user has voted
     * within the current voting cooldown.
     */
    public async hasVoted(
        discordId: string
    ): Promise<VoteCheck> {
        return this.request<VoteCheck>(
            `/votes/check?discordId=${encodeURIComponent(discordId)}`
        );
    }

    /**
     * Get recent votes for the listing.
     */
    public async getVotes(
        limit: number = 50,
        page: number = 1
    ): Promise<VotesResponse> {
        if (limit < 1 || limit > 100) {
            throw new RangeError(
                "Vote limit must be between 1 and 100."
            );
        }

        if (page < 1) {
            throw new RangeError(
                "Vote page must be greater than or equal to 1."
            );
        }

        return this.request<VotesResponse>(
            `/votes?limit=${limit}&page=${page}`
        );
    }

    /**
     * Get analytics for the listing.
     *
     * @param days Number of days to retrieve (1-90).
     */
    public async getAnalytics(
        days: number = 7
    ): Promise<Analytics> {
        if (days < 1 || days > 90) {
            throw new RangeError(
                "Analytics days must be between 1 and 90."
            );
        }

        return this.request<Analytics>(
            `/analytics?days=${days}`
        );
    }

    /**
     * Post bot statistics to TopDiscordList.
     */
    public async postStats(
        stats: BotStats
    ): Promise<void> {
        const listing = await this.getListing();

        await this.request(
            `/stats`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(stats)
            }
        );
    }

    /**
     * Verify a TopDiscordList webhook signature.
     *
     * The raw request body must be provided before JSON parsing.
     */
    public static verifyWebhook(
        signature: string,
        rawBody: string | Buffer,
        token: string
    ): boolean {
        try {
            const match = signature.match(
                /^t=(\d+),v1=([a-f0-9]+)$/
            );

            if (!match) {
                return false;
            }

            const timestamp = Number(match[1]);
            const providedSignature = match[2];

            const now = Math.floor(Date.now() / 1000);

            // Reject signatures older/newer than 5 minutes.
            if (Math.abs(now - timestamp) > 300) {
                return false;
            }

            const payload =
                `${timestamp}.${rawBody.toString()}`;

            const expectedSignature =
                crypto
                    .createHmac("sha256", token)
                    .update(payload)
                    .digest("hex");

            const expectedBuffer =
                Buffer.from(expectedSignature, "utf8");

            const providedBuffer =
                Buffer.from(providedSignature, "utf8");

            if (
                expectedBuffer.length !==
                providedBuffer.length
            ) {
                return false;
            }

            return crypto.timingSafeEqual(
                expectedBuffer,
                providedBuffer
            );
        } catch {
            return false;
        }
    }

    public expressWebhook(
        handler: (payload: WebhookPayload) => Promise<void> | void
    ): RequestHandler {
        return async (req, res, next) => {
            const signature = req.headers["x-tdl-signature"];

            if (
                typeof signature !== "string" ||
                !Buffer.isBuffer(req.body)
            ) {
                return res.sendStatus(400);
            }

            const valid = Client.verifyWebhook(
                signature,
                req.body,
                this.token
            );

            if (!valid) {
                return res.sendStatus(401);
            }

            let payload: WebhookPayload;

            try {
                payload = JSON.parse(
                    req.body.toString("utf8")
                );
            } catch {
                return res.sendStatus(400);
            }

            res.sendStatus(200);

            try {
                await handler(payload);
            } catch (error) {
                console.error(
                    "[TopDiscordList] Webhook handler failed:",
                    error
                );
            }
        };
    }
}