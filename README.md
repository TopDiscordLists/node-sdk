# @topdiscordlist/sdk

Hand out rewards when someone votes for your Discord server or bot on
[Top Discord List](https://topdiscordlist.com).

```bash
npm install @topdiscordlist/sdk
```

> **Not on npm yet.** The first release is still to come. Until then:
>
> ```bash
> npm install github:TopDiscordLists/node-sdk
> ```

```js
const { VoteListener } = require("@topdiscordlist/sdk");

new VoteListener(process.env.TDL_TOKEN)
  .on("vote", (vote) => giveReward(vote.userId))
  .connect();
```

That is a working integration. Everything below is detail.

Node 18 or newer. Node 22 has a built in WebSocket, so the stream works out of
the box; on 18 and 20 install [`ws`](https://www.npmjs.com/package/ws) and pass
it in as `new VoteListener(token, { WebSocket: require("ws") })`.

## Getting a token

Open your listing, hit **Edit listing**, scroll to **Developer integrations**,
and generate a listing token. It is shown once, so put it straight into an
environment variable.

The same panel has a **Send test event** button that fires a real signed
delivery at your webhook URL, so you can check your wiring without waiting for
somebody to actually vote.

## Two ways to hear about a vote

**The vote stream** is a WebSocket. Your bot dials out to us, so it works from a
laptop, a Raspberry Pi, or a container with no public URL and no port
forwarding. It is the quickest thing to get running.

**Webhooks** go the other way: you give us a URL and we POST to it. That needs a
public web server, but you get durability in exchange. If your bot is down we
keep retrying for three hours, so a deploy never loses a vote.

Plenty of people run both, taking the stream for instant reactions and letting
webhooks catch anything missed during a restart.

## The vote stream

```js
const { VoteListener } = require("@topdiscordlist/sdk");

const listener = new VoteListener(process.env.TDL_TOKEN);

listener
  .on("ready", () => console.log("listening"))
  .on("vote", async (vote) => {
    await giveReward(vote.userId);
  })
  .on("error", (err) => console.error(err))
  .connect();
```

It reconnects on its own with backoff. Call `listener.close()` to stop.

Votes that land while you are disconnected are gone, so if missing one would be
a real problem, run webhooks too.

## Webhooks

With no framework:

```js
const http = require("node:http");
const { webhookHandler } = require("@topdiscordlist/sdk");

http
  .createServer(
    webhookHandler(process.env.TDL_WEBHOOK_SECRET, async (payload) => {
      if (payload.vote.isTest) return;
      await giveReward(payload.user.discordId);
    }),
  )
  .listen(3000);
```

With Express, mount the raw body parser first or the signature will not match:

```js
const express = require("express");
const { expressWebhook } = require("@topdiscordlist/sdk");

app.post(
  "/vote",
  express.raw({ type: "application/json" }),
  expressWebhook(process.env.TDL_WEBHOOK_SECRET, async (payload) => {
    if (payload.vote.isTest) return;
    await giveReward(payload.user.discordId);
  }),
);
```

Both helpers verify the signature, reply 200, and only then run your callback,
so a slow reward never turns into a retry.

Verifying by hand, if you have a router you like:

```js
const { verifySignature } = require("@topdiscordlist/sdk");

if (!verifySignature(secret, req.headers["x-tdl-signature"], rawBody)) {
  return res.sendStatus(401);
}
```

`rawBody` has to be the bytes you received. If you parse the JSON and
re-serialize it, key order and whitespace change and the signature stops
matching.

## Test events

A test delivery is identical to a real one except `event` is `"test"` and
`vote.isTest` is `true`. Branch on it, or you will hand yourself free rewards
every time you press the button.

## Calling the API

```js
const { TopDiscordList } = require("@topdiscordlist/sdk");
const client = new TopDiscordList(process.env.TDL_TOKEN);

await client.listing();
await client.hasVoted("123456789012345678");
await client.hasVotedByUserId("user_abc");
await client.votes({ limit: 50, page: 1 });
await client.analytics({ days: 7 });
await client.postStats({ slug: "my-bot", serverCount: 1200, shardCount: 4 });
```

`hasVoted` already accounts for the 24 hour cooldown, so you can use `voted`
directly. It also returns `expiresAt`, which is handy for a "come back in 6
hours" message.

TypeScript definitions ship with the package, no `@types` needed.

## Links

- [Developer docs](https://topdiscordlist.com/developers)
- [Raw HTTP and WebSocket reference](https://github.com/TopDiscordLists/api-docs)
- [SDKs in other languages](https://github.com/TopDiscordLists)

## Contributing

`node conformance/run.mjs` checks this package against
[the shared signature vectors](test-vectors.json), the same eight cases every
other language SDK has to pass. CI runs it on every push. If the signature logic
breaks, people quietly stop receiving votes, which is why that gate exists.

MIT licensed.
