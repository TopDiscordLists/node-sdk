export interface ClientOptions {
    token: string;
    apiUrl?: string;
}
export interface Listing {
    type: string;
    id: string;
    slug: string;
    name: string;
    voteCount: number;
}
export interface VoteCheck {
    voted: boolean;
    votedAt?: string;
    expiresAt?: string;
}
export interface VoteUser {
    id: string;
    username: string;
    discordId: string;
}
export interface Vote {
    id: string;
    votedAt: string;
    user: VoteUser;
}
export interface VotesResponse {
    votes: Vote[];
    page: number;
    limit: number;
}
export interface Analytics {
    listing: Listing;
    window: {
        days: number;
        from: string;
        to: string;
    };
    totals: {
        impressions: number;
        clicks: number;
        joins: number;
        votes: number;
        clickThroughRate: number;
        joinRate: number;
    };
    daily: AnalyticsDaily[];
}
export interface AnalyticsDaily {
    date: string;
    impressions: number;
    clicks: number;
    joins: number;
    votes: number;
}
export interface BotStats {
    serverCount: number;
    userCount?: number;
    shardCount?: number;
}
export interface WebhookVote {
    id: string;
    votedAt: string;
    isTest?: boolean;
}
export interface WebhookUser {
    id: string;
    username: string;
    discordId: string;
}
export interface WebhookListing {
    type: string;
    id: string;
    slug: string;
    name: string;
    voteCount: number;
}
export interface WebhookStreak {
    listing: number;
    global: number;
}
export interface VoteWebhook {
    event: "vote" | "test";
    deliveryId: string;
    sentAt: string;
    vote: WebhookVote;
    user: WebhookUser;
    listing: WebhookListing;
    streak: WebhookStreak;
}
export interface WebhookPayload {
    event: "vote" | "test";
    deliveryId: string;
    sentAt: string;
    vote: {
        id: string;
        votedAt: string;
        isTest?: boolean;
    };
    user: {
        id: string;
        username: string;
        discordId: string;
    };
    listing: {
        type: "bot" | "server";
        id: string;
        slug: string;
        name: string;
        voteCount: number;
    };
    streak: {
        listing: number;
        global: number;
    };
}
