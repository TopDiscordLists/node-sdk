"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const errors_js_1 = require("../utils/errors.js");
const crypto_1 = __importDefault(require("crypto"));
const API_VERSION = "v1";
const DEFAULT_API_URL = "https://topdiscordlist.pages.dev/api";
class Client {
    token;
    apiUrl;
    constructor(options) {
        this.token = options.token;
        this.apiUrl =
            options.apiUrl ??
                `${DEFAULT_API_URL}/${API_VERSION}`;
    }
    async request(endpoint, options = {}) {
        const response = await fetch(`${this.apiUrl}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bot ${this.token}`,
                ...options.headers
            }
        });
        const text = await response.text();
        if (!response.ok) {
            let errorMessage = "An unknown API error occurred.";
            if (text) {
                try {
                    const data = JSON.parse(text);
                    errorMessage =
                        data.error ?? errorMessage;
                }
                catch {
                    // Response wasn't valid JSON.
                }
            }
            throw new errors_js_1.APIError(errorMessage, response.status);
        }
        if (!text) {
            return undefined;
        }
        return JSON.parse(text);
    }
    /**
     * Get the listing associated with this token.
     */
    async getListing() {
        const data = await this.request("/listing");
        return data.listing;
    }
    /**
     * Check whether a Discord user has voted
     * within the current voting cooldown.
     */
    async hasVoted(discordId) {
        return this.request(`/votes/check?discordId=${encodeURIComponent(discordId)}`);
    }
    /**
     * Get recent votes for the listing.
     */
    async getVotes(limit = 50, page = 1) {
        if (limit < 1 || limit > 100) {
            throw new RangeError("Vote limit must be between 1 and 100.");
        }
        if (page < 1) {
            throw new RangeError("Vote page must be greater than or equal to 1.");
        }
        return this.request(`/votes?limit=${limit}&page=${page}`);
    }
    /**
     * Get analytics for the listing.
     *
     * @param days Number of days to retrieve (1-90).
     */
    async getAnalytics(days = 7) {
        if (days < 1 || days > 90) {
            throw new RangeError("Analytics days must be between 1 and 90.");
        }
        return this.request(`/analytics?days=${days}`);
    }
    /**
     * Post bot statistics to TopDiscordList.
     */
    async postStats(stats) {
        const listing = await this.getListing();
        await this.request(`/stats`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(stats)
        });
    }
    /**
     * Verify a TopDiscordList webhook signature.
     *
     * The raw request body must be provided before JSON parsing.
     */
    static verifyWebhook(signature, rawBody, token) {
        try {
            const match = signature.match(/^t=(\d+),v1=([a-f0-9]+)$/);
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
            const payload = `${timestamp}.${rawBody.toString()}`;
            const expectedSignature = crypto_1.default
                .createHmac("sha256", token)
                .update(payload)
                .digest("hex");
            const expectedBuffer = Buffer.from(expectedSignature, "utf8");
            const providedBuffer = Buffer.from(providedSignature, "utf8");
            if (expectedBuffer.length !==
                providedBuffer.length) {
                return false;
            }
            return crypto_1.default.timingSafeEqual(expectedBuffer, providedBuffer);
        }
        catch {
            return false;
        }
    }
    expressWebhook(handler) {
        return async (req, res, next) => {
            const signature = req.headers["x-tdl-signature"];
            if (typeof signature !== "string" ||
                !Buffer.isBuffer(req.body)) {
                return res.sendStatus(400);
            }
            const valid = Client.verifyWebhook(signature, req.body, this.token);
            if (!valid) {
                return res.sendStatus(401);
            }
            let payload;
            try {
                payload = JSON.parse(req.body.toString("utf8"));
            }
            catch {
                return res.sendStatus(400);
            }
            res.sendStatus(200);
            try {
                await handler(payload);
            }
            catch (error) {
                console.error("[TopDiscordList] Webhook handler failed:", error);
            }
        };
    }
}
exports.Client = Client;
