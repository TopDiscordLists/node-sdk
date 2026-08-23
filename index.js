"use strict";

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

const DEFAULT_BASE_URL = "https://topdiscordlist.com/api";
const SIGNATURE_HEADER = "x-tdl-signature";
const EVENT_HEADER = "x-tdl-event";
const DEFAULT_TOLERANCE_SECONDS = 300;

class TopDiscordListError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TopDiscordListError";
    this.status = status;
  }
}

function parseSignatureHeader(header) {
  if (typeof header !== "string" || !header) return null;
  const parts = {};
  for (const chunk of header.split(",")) {
    const eq = chunk.indexOf("=");
    if (eq <= 0) continue;
    parts[chunk.slice(0, eq).trim()] = chunk.slice(eq + 1).trim();
  }
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return null;
  return { timestamp, signature: parts.v1 };
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function sign(secret, timestamp, rawBody) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function verifySignature(secret, header, rawBody, options = {}) {
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  if (tolerance > 0 && Math.abs(now - parsed.timestamp) > tolerance) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  return safeEqualHex(sign(secret, parsed.timestamp, body), parsed.signature);
}

class TopDiscordList {
  constructor(token, options = {}) {
    if (!token) throw new TopDiscordListError("A listing token is required");
    this.token = token;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetch = options.fetch || globalThis.fetch;
  }

  async _request(path, init = {}) {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${this.token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) throw new TopDiscordListError(data.error || res.statusText, res.status);
    return data;
  }

  listing() {
    return this._request("/v1/listing");
  }

  hasVoted(discordId) {
    return this._request(`/v1/votes/check?discordId=${encodeURIComponent(discordId)}`);
  }

  hasVotedByUserId(userId) {
    return this._request(`/v1/votes/check?userId=${encodeURIComponent(userId)}`);
  }

  votes({ limit = 50, page = 1 } = {}) {
    return this._request(`/v1/votes?limit=${limit}&page=${page}`);
  }

  analytics({ days = 7 } = {}) {
    return this._request(`/v1/analytics?days=${days}`);
  }

  postStats(stats) {
    if (!stats || typeof stats.serverCount !== "number") {
      throw new TopDiscordListError("serverCount is required");
    }
    const slug = stats.slug;
    if (!slug) throw new TopDiscordListError("slug is required to post stats");
    const body = {
      serverCount: stats.serverCount,
      ...(stats.userCount !== undefined ? { userCount: stats.userCount } : {}),
      ...(stats.shardCount !== undefined ? { shardCount: stats.shardCount } : {}),
    };
    return this._request(`/bots/${encodeURIComponent(slug)}/stats`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

function webhookHandler(secret, onVote, options = {}) {
  return async function handler(req, res) {
    let raw = "";
    for await (const chunk of req) raw += chunk;

    if (!verifySignature(secret, req.headers[SIGNATURE_HEADER], raw, options)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid signature" }));
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid json" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));

    try {
      await onVote(payload, { event: req.headers[EVENT_HEADER] || payload.event });
    } catch (err) {
      if (options.onError) options.onError(err);
    }
  };
}

function expressWebhook(secret, onVote, options = {}) {
  return async function middleware(req, res) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.rawBody;
    if (typeof raw !== "string") {
      res.status(500).json({ error: "raw body unavailable, mount express.raw({ type: 'application/json' })" });
      return;
    }
    if (!verifySignature(secret, req.get(SIGNATURE_HEADER), raw, options)) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
    const payload = JSON.parse(raw);
    res.status(200).json({ ok: true });
    try {
      await onVote(payload, { event: req.get(EVENT_HEADER) || payload.event });
    } catch (err) {
      if (options.onError) options.onError(err);
    }
  };
}

class VoteListener extends EventEmitter {
  constructor(token, options = {}) {
    super();
    if (!token) throw new TopDiscordListError("A listing token is required");
    this.token = token;
    const base = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.url = base.replace(/^http/, "ws") + "/v1/events/votes";
    this.WebSocketImpl = options.WebSocket || globalThis.WebSocket;
    this.maxBackoffMs = options.maxBackoffMs || 30_000;
    this.pingIntervalMs = options.pingIntervalMs || 45_000;
    this._backoff = 1000;
    this._closed = false;
    this._ws = null;
    this._pingTimer = null;
  }

  connect() {
    if (this._closed) return this;
    if (!this.WebSocketImpl) {
      throw new TopDiscordListError(
        "No WebSocket implementation found. On Node 20 or older, pass { WebSocket } from the 'ws' package.",
      );
    }

    const ws = new this.WebSocketImpl(this.url, { headers: { Authorization: `Bot ${this.token}` } });
    this._ws = ws;

    const onOpen = () => {
      this._backoff = 1000;
      this.emit("open");
      this._pingTimer = setInterval(() => {
        try {
          ws.send("ping");
        } catch {
          return;
        }
      }, this.pingIntervalMs);
    };

    const onMessage = (raw) => {
      let msg;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.data ? String(raw.data) : raw.toString());
      } catch {
        return;
      }
      if (msg.type === "vote") this.emit("vote", msg);
      else if (msg.type === "ready") this.emit("ready", msg);
      else if (msg.type === "pong") this.emit("pong");
    };

    const onClose = () => {
      clearInterval(this._pingTimer);
      this.emit("close");
      if (this._closed) return;
      setTimeout(() => this.connect(), this._backoff);
      this._backoff = Math.min(this._backoff * 2, this.maxBackoffMs);
    };

    if (typeof ws.on === "function") {
      ws.on("open", onOpen);
      ws.on("message", onMessage);
      ws.on("close", onClose);
      ws.on("error", (err) => this.emit("error", err));
    } else {
      ws.onopen = onOpen;
      ws.onmessage = (e) => onMessage(e.data);
      ws.onclose = onClose;
      ws.onerror = (err) => this.emit("error", err);
    }

    return this;
  }

  close() {
    this._closed = true;
    clearInterval(this._pingTimer);
    if (this._ws) {
      try {
        this._ws.close();
      } catch {
        return;
      }
    }
  }
}

module.exports = {
  TopDiscordList,
  TopDiscordListError,
  VoteListener,
  verifySignature,
  webhookHandler,
  expressWebhook,
  SIGNATURE_HEADER,
  EVENT_HEADER,
};
