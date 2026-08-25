# @topdiscordlist/sdk

Official JavaScript/TypeScript SDK for interacting with the TopDiscordList API.

The SDK provides:

- Listing information
- Vote checking
- Recent votes
- Listing analytics
- Bot statistics
- Webhook signature verification
- Express webhook handling

## Requirements

- Node.js 18+
- A TopDiscordList listing
- A TopDiscordList listing token

## Installation

```bash
npm install @topdiscordlist/sdk
```

## Getting Your Token

1. Open your TopDiscordList.
2. Go to **Dashborad**.
3. Select the bot and head to **Developer Integrations**.
4. Generate a token.
5. Store the token securely.

Your token should never be exposed publicly or committed to Git.

---

# Basic Usage

## CommonJS

```js
const { Client } = require("@topdiscordlist/sdk");

const tdl = new Client({
    token: process.env.TDL_TOKEN
});
```

## TypeScript / ESM

```ts
import { Client } from "@topdiscordlist/sdk";

const tdl = new Client({
    token: process.env.TDL_TOKEN
});
```

---

# Environment Variables

A `.env` file can be used:

```env
TDL_TOKEN=your_listing_token
```

Then load it with `dotenv`:

```bash
npm install dotenv
```

```js
require("dotenv").config();
```

---

# API Methods

## getListing()

Returns the listing associated with the configured token.

```js
const listing = await tdl.getListing();

console.log(listing);
```

Example response:

```js
{
    type: "bot",
    id: "bot_a1b2c3",
    slug: "example-bot",
    name: "Example Bot",
    voteCount: 42
}
```

---

## hasVoted()

Checks whether a Discord user has voted within the current voting cooldown.

```js
const vote = await tdl.hasVoted("123456789012345678");

console.log(vote);
```

Example response:

```js
{
    voted: true,
    votedAt: "2026-08-23T04:00:00.000Z",
    expiresAt: "2026-08-24T04:00:00.000Z"
}
```

The `voted` property is already adjusted for the current voting cooldown.

---

## getVotes()

Gets recent votes for your listing.

```js
const votes = await tdl.getVotes();
```

You can specify the page size and page number:

```js
const votes = await tdl.getVotes(100, 1);
```

Parameters:

| Parameter | Default | Maximum |
|---|---:|---:|
| `limit` | `50` | `100` |
| `page` | `1` | — |

Example response:

```js
{
    votes: [
        {
            id: "vote_4b81e2",
            votedAt: "2026-08-23T04:00:00.000Z",
            user: {
                id: "user_a1b2c3",
                username: "voter",
                discordId: "123456789012345678"
            }
        }
    ],
    page: 1,
    limit: 50
}
```

---

## getAnalytics()

Gets analytics for your listing.

```js
const analytics = await tdl.getAnalytics();
```

By default, analytics for the last 7 days are returned.

You can specify between 1 and 90 days:

```js
const analytics = await tdl.getAnalytics(30);
```

Example response:

```js
{
    listing: {
        type: "bot",
        id: "bot_a1b2c3",
        slug: "example-bot",
        name: "Example Bot",
        voteCount: 42
    },
    window: {
        days: 7,
        from: "2026-08-17",
        to: "2026-08-23"
    },
    totals: {
        impressions: 2400,
        clicks: 214,
        joins: 48,
        votes: 31,
        clickThroughRate: 8.92,
        joinRate: 22.43
    },
    daily: [
        {
            date: "2026-08-17",
            impressions: 600,
            clicks: 30,
            joins: 6,
            votes: 4
        }
    ]
}
```

The API returns percentages already rounded to two decimal places.

---

## postStats()

Posts statistics for your bot.

```js
await tdl.postStats({
    serverCount: 1200,
    userCount: 450000,
    shardCount: 4
});
```

`serverCount` is required.

`userCount` and `shardCount` are optional.

Example with Discord.js:

```js
await tdl.postStats({
    serverCount: client.guilds.cache.size,
    userCount: client.users.cache.size,
    shardCount: client.ws.shards.size
});
```

---

# Webhooks

TopDiscordList can send vote notifications directly to your bot.

Webhooks are recommended when you need reliable vote delivery because they:

- Do not require a persistent WebSocket connection.
- Work with bots hosted behind NAT.
- Work on servers where only one HTTP port is available.
- Retry failed deliveries.
- Allow the SDK to verify the authenticity of the request.

Configure your webhook URL under:

**Edit Listing → Vote Rewards**

For example:

```text
https://your-domain.com/vote
```

---

# Express Webhook

The SDK provides an Express middleware helper for handling TopDiscordList webhooks.

```js
const express = require("express");
const {
    Client
} = require("@topdiscordlist/sdk");

const app = express();

const tdl = new Client({
    token: process.env.TDL_TOKEN
});

app.post(
    "/vote",
    express.raw({ type: "application/json" }),
    tdl.expressWebhook(process.env.TDL_TOKEN, async (payload) => {
        if (payload.vote.isTest) {
            console.log("[TDL] Test vote received");
            return;
        }

        console.log(
            `${payload.user.username} voted for ${payload.listing.name}!`
        );

        // Give the user their reward here.
    })
);

app.listen(3000, () => {
    console.log("HTTP server listening on port 3000");
});
```

## Important

The webhook route **must** use:

```js
express.raw({ type: "application/json" })
```

Do not use:

```js
app.use(express.json());
```

before the webhook route.

The webhook signature is calculated using the original request body. Parsing the JSON first can change the body and cause signature verification to fail.

---

# Test Webhooks

TopDiscordList provides test webhook deliveries from your listing dashboard.

A test webhook looks like a normal vote except:

```js
payload.event === "test"
```

and:

```js
payload.vote.isTest === true
```

Always check `isTest` before giving out rewards.

Example:

```js
tdl.expressWebhook(process.env.TDL_TOKEN, async (payload) => {
    if (payload.vote.isTest) {
        console.log("[TDL] Test webhook received.");
        return;
    }

    await giveReward(payload.user.discordId);
});
```

---

# Webhook Payload

A normal vote webhook contains:

```json
{
    "event": "vote",
    "deliveryId": "whd_9f2c1a",
    "sentAt": "2026-08-23T04:00:00.000Z",
    "vote": {
        "id": "vote_4b81e2",
        "votedAt": "2026-08-23T04:00:00.000Z"
    },
    "user": {
        "id": "user_a1b2c3",
        "username": "voter",
        "discordId": "123456789012345678"
    },
    "listing": {
        "type": "bot",
        "id": "bot_a1b2c3",
        "slug": "example-bot",
        "name": "Example Bot",
        "voteCount": 43
    },
    "streak": {
        "listing": 3,
        "global": 12
    }
}
```

---

# Webhook Retries

TopDiscordList retries webhook deliveries if your server does not return a successful HTTP response.

Retry intervals are:

- 1 minute
- 5 minutes
- 15 minutes
- 60 minutes
- 180 minutes

There can be up to six delivery attempts.

Any HTTP status in the `2xx` range is considered successful.

The `deliveryId` remains the same when a webhook is retried.

If your reward system must prevent duplicate rewards, store processed delivery IDs.

Example:

```js
const processedDeliveries = new Set();

expressWebhook(process.env.TDL_TOKEN, async (payload) => {
    if (payload.vote.isTest) {
        return;
    }

    if (processedDeliveries.has(payload.deliveryId)) {
        return;
    }

    processedDeliveries.add(payload.deliveryId);

    await giveReward(payload.user.discordId);
});
```

For production applications, use a database or persistent storage instead of an in-memory `Set`.

---

# Manual Webhook Signature Verification

If you are not using the Express helper, the SDK provides webhook signature verification.

```js
const { Client } = require("@topdiscordlist/sdk");

const valid = Client.verifyWebhook(
    req.headers["x-tdl-signature"],
    rawBody,
    process.env.TDL_TOKEN
);

if (!valid) {
    return res.sendStatus(401);
}
```

The request body must be the original raw body.

The SDK verifies:

- The HMAC-SHA256 signature.
- The timestamp.
- The five-minute timestamp window.
- The signature using a constant-time comparison.

---

# Health Endpoint Example

The SDK does not create a health endpoint automatically.

Your application can expose one for monitoring services:

```js
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok"
    });
});
```

A Discord bot can also report whether Discord is connected:

```js
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        discord: discord.isReady(),
        timestamp: new Date().toISOString()
    });
});
```

---

# Complete Discord.js Example

```js
require("dotenv").config();

const express = require("express");
const {
    Client: DiscordClient,
    GatewayIntentBits
} = require("discord.js");

const {
    Client: TDLClient,
} = require("@topdiscordlist/sdk");

const app = express();

const PORT = process.env.PORT || 3000;

const discord = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

const tdl = new TDLClient({
    token: process.env.TDL_TOKEN
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        discord: discord.isReady(),
        timestamp: new Date().toISOString()
    });
});

app.post(
    "/vote",
    express.raw({ type: "application/json" }),
    tdl.expressWebhook(process.env.TDL_TOKEN, async (payload) => {
        if (payload.vote.isTest) {
            console.log("[TDL] Test vote received.");
            return;
        }

        console.log(
            `[TDL] ${payload.user.username} voted!`
        );

        // Give the user their reward here.
    })
);

discord.once("ready", async (client) => {
    console.log(`Logged in as ${client.user.tag}`);

    try {
        const listing = await tdl.getListing();

        console.log("[TDL] Listing:", listing);

        await tdl.postStats({
            serverCount: client.guilds.cache.size,
            userCount: client.users.cache.size,
            shardCount: client.ws.shards.size
        });

        console.log("[TDL] Stats posted successfully.");
    } catch (error) {
        console.error("[TDL] SDK error:", error);
    }
});

app.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

discord.login(process.env.DISCORD_TOKEN);
```

---

# Error Handling

API errors are returned as `APIError` instances.

```js
try {
    const listing = await tdl.getListing();

    console.log(listing);
} catch (error) {
    console.error(error);
}
```

You can inspect the HTTP status:

```js
try {
    await tdl.getListing();
} catch (error) {
    console.error(error.message);
    console.error(error.status);
}
```

Common API status codes:

| Status | Meaning |
|---:|---|
| `400` | Request was malformed |
| `401` | Authorization header is missing |
| `403` | Token is invalid, revoked, or belongs to another listing |
| `404` | Listing does not exist or is not public |
| `429` | Rate limit exceeded |

---

# Rate Limits

Rate limits are applied per listing token.

| Endpoint | Limit |
|---|---:|
| `GET /v1/listing` | 60/min |
| `GET /v1/votes/check` | 120/min |
| `GET /v1/votes` | 60/min |
| `GET /v1/analytics` | 30/min |
| `POST /bots/:slug/stats` | 30/min |

---

# API Base URL

The SDK uses:

```text
https://topdiscordlist.com/api/v1
```

By default.

A custom API URL can be provided:

```js
const tdl = new Client({
    token: process.env.TDL_TOKEN,
    apiUrl: "https://example.com/api/v1"
});
```

---

# Security

Keep your listing token private.

Do not:

- Commit your token to Git.
- Put your token in client-side/browser code.
- Include your token in URLs.
- Send your token to users.
- Log your token.

Recommended:

```env
TDL_TOKEN=your_secret_token
```

Then:

```js
const tdl = new Client({
    token: process.env.TDL_TOKEN
});
```

---

# TypeScript

The SDK includes TypeScript typings.

```ts
import {
    Client,
    Listing,
    VoteCheck,
    VotesResponse,
    Analytics,
    BotStats
} from "@topdiscordlist/sdk";

const tdl = new Client({
    token: process.env.TDL_TOKEN!
});

const listing: Listing = await tdl.getListing();

const vote: VoteCheck = await tdl.hasVoted(
    "123456789012345678"
);

const votes: VotesResponse = await tdl.getVotes();

const analytics: Analytics = await tdl.getAnalytics(30);

const stats: BotStats = {
    serverCount: 100,
    userCount: 5000,
    shardCount: 1
};

await tdl.postStats(stats);
```

---

# License

MIT
``` 
```