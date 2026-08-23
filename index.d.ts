export interface VotePayload {
  event: "vote" | "test";
  deliveryId: string;
  sentAt: string;
  vote: { id: string; votedAt: string; isTest?: boolean };
  user: { id: string; username: string; discordId: string | null };
  listing: { type: "server" | "bot"; id: string; slug: string; name: string; voteCount: number };
  streak: { listing: number; global: number };
}

export interface VerifyOptions {
  toleranceSeconds?: number;
  now?: number;
}

export declare class TopDiscordListError extends Error {
  status?: number;
}

export declare function verifySignature(
  secret: string,
  header: string | undefined | null,
  rawBody: string | Buffer,
  options?: VerifyOptions,
): boolean;

export declare function webhookHandler(
  secret: string,
  onVote: (payload: VotePayload, meta: { event: string }) => void | Promise<void>,
  options?: VerifyOptions & { onError?: (err: unknown) => void },
): (req: any, res: any) => Promise<void>;

export declare function expressWebhook(
  secret: string,
  onVote: (payload: VotePayload, meta: { event: string }) => void | Promise<void>,
  options?: VerifyOptions & { onError?: (err: unknown) => void },
): (req: any, res: any) => Promise<void>;

export declare class TopDiscordList {
  constructor(token: string, options?: { baseUrl?: string; fetch?: typeof fetch });
  listing(): Promise<{ listing: VotePayload["listing"] | null }>;
  hasVoted(discordId: string): Promise<{ voted: boolean; votedAt: string | null; expiresAt: string | null }>;
  hasVotedByUserId(userId: string): Promise<{ voted: boolean; votedAt: string | null; expiresAt: string | null }>;
  votes(options?: { limit?: number; page?: number }): Promise<{ votes: unknown[]; page: number; limit: number }>;
  analytics(options?: { days?: number }): Promise<{
    listing: VotePayload["listing"] | null;
    window: { days: number; from: string; to: string };
    totals: {
      impressions: number;
      clicks: number;
      joins: number;
      votes: number;
      clickThroughRate: number;
      joinRate: number;
    };
    daily: { date: string; impressions: number; clicks: number; joins: number; votes: number }[];
  }>;
  postStats(stats: { slug: string; serverCount: number; userCount?: number; shardCount?: number }): Promise<{ ok: boolean; reportedAt: string }>;
}

export declare class VoteListener {
  constructor(token: string, options?: { baseUrl?: string; WebSocket?: unknown; maxBackoffMs?: number; pingIntervalMs?: number });
  connect(): this;
  close(): void;
  on(event: "vote", handler: (vote: Record<string, unknown>) => void): this;
  on(event: "ready" | "open" | "close" | "pong", handler: (payload?: unknown) => void): this;
  on(event: "error", handler: (err: unknown) => void): this;
}

export declare const SIGNATURE_HEADER: string;
export declare const EVENT_HEADER: string;
