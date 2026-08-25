# The API without an SDK

Everything the SDKs do is plain HTTP and one WebSocket. If we don't ship a
package for your language, you are not missing anything, you just write about
twenty lines yourself.

Base URL: `https://topdiscordlist.com/api`

Authentication is one header on every request:

```text
Authorization: Bot YOUR_LISTING_TOKEN
```

Your token comes from your listing: **Edit listing → Developer integrations →
Generate token**. It is shown once.

## Endpoints

### Your listing

```bash
curl https://topdiscordlist.com/api/v1/listing \
  -H "Authorization: Bot $TDL_TOKEN"
```

```json
{
  "listing": {
    "type": "bot",
    "id": "bot_a1b2c3",
    "slug": "example-bot",
    "name": "Example Bot",
    "voteCount": 42
  }
}
```

### Has this user voted?

The usual question: someone runs a command, and you want to know whether they
have voted in the last 24 hours.

```bash
curl "https://topdiscordlist.com/api/v1/votes/check?discordId=123456789012345678" \
  -H "Authorization: Bot $TDL_TOKEN"
```

```json
{
  "voted": true,
  "votedAt": "2026-08-23T04:00:00.000Z",
  "expiresAt": "2026-08-24T04:00:00.000Z"
}
```

`voted` is already adjusted for the cooldown, so you can use it directly.
`expiresAt` tells you when they can vote again, which is handy for a "come back
in 6 hours" message.

Swap `discordId` for `userId` if you happen to have our internal id instead.
An unknown user is not an error, you get `voted: false`.

### Recent voters

```bash
curl "https://topdiscordlist.com/api/v1/votes?limit=50&page=1" \
  -H "Authorization: Bot $TDL_TOKEN"
```

```json
{
  "votes": [
    {
      "id": "vote_4b81e2",
      "votedAt": "2026-08-23T04:00:00.000Z",
      "user": { "id": "user_a1b2c3", "username": "voter", "discordId": "123456789012345678" }
    }
  ],
  "page": 1,
  "limit": 50
}
```

`limit` maxes out at 100.

### Report your bot's stats

Bots only. Once you post stats, the numbers on your listing come from here and
manual edits in the dashboard are ignored, so the two can't disagree.

```bash
curl -X POST https://topdiscordlist.com/api/bots/example-bot/stats \
  -H "Authorization: Bot $TDL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serverCount": 1200, "userCount": 450000, "shardCount": 4}'
```

Only `serverCount` is required.

## The vote stream

A WebSocket that pushes each vote the moment it happens. Your bot dials out, so
this works from a laptop, a home server, or a container with no public URL.

```text
wss://topdiscordlist.com/api/v1/events/votes
Authorization: Bot YOUR_LISTING_TOKEN
```

The token goes in a header, not the query string, so it never lands in a proxy
log. Any WebSocket client that lets you set headers will do:

```bash
websocat -H "Authorization: Bot $TDL_TOKEN" \
  wss://topdiscordlist.com/api/v1/events/votes
```

On connect you get a handshake frame:

```json
{ "type": "ready", "scope": "listing", "listing": { "type": "bot", "id": "bot_a1b2c3" } }
```

Then one frame per vote:

```json
{
  "type": "vote",
  "scope": "listing",
  "voteId": "vote_4b81e2",
  "userId": "user_a1b2c3",
  "username": "voter",
  "targetType": "bot",
  "targetId": "bot_a1b2c3",
  "slug": "example-bot",
  "name": "Example Bot",
  "voteCount": 43,
  "votedAt": "2026-08-23T04:00:00.000Z"
}
```

Send the string `ping` whenever you like and you get `{"type":"pong"}` back.
Reconnect with backoff if the socket closes. Votes that happen while you are
disconnected are gone, so if you can't afford to miss any, run webhooks too.

## Webhooks

Set a URL under **Vote rewards** on your listing and we POST every vote to it.
Unlike the stream, we retry: 1, 5, 15, 60, and 180 minutes, up to six attempts.
Anything in the 2xx range counts as delivered.

Three headers come with each delivery:

```text
X-TDL-Signature: t=1756000000,v1=dd730ec48c53f4e1f86abc3c9a77207ce15ffddb8f20055227fef9e6bf8f5e8a
X-TDL-Event: vote
X-TDL-Delivery: whd_9f2c1a
```

And the body:

```json
{
  "event": "vote",
  "deliveryId": "whd_9f2c1a",
  "sentAt": "2026-08-23T04:00:00.000Z",
  "vote": { "id": "vote_4b81e2", "votedAt": "2026-08-23T04:00:00.000Z" },
  "user": { "id": "user_a1b2c3", "username": "voter", "discordId": "123456789012345678" },
  "listing": { "type": "bot", "id": "bot_a1b2c3", "slug": "example-bot", "name": "Example Bot", "voteCount": 43 },
  "streak": { "listing": 3, "global": 12 }
}
```

A test delivery you trigger yourself is identical except `event` is `test` and
`vote.isTest` is `true`. Check that before handing out anything real.

Reply 2xx as soon as you have the payload and do the reward afterwards. If you
hold the connection open while you work and it times out on our side, you get a
retry and the user gets rewarded twice. `deliveryId` is stable across retries,
so store the ones you have handled if that would be a problem.

## Verifying a signature

This is the only part with any subtlety, and it is four lines in most languages.

```text
signature = HMAC-SHA256(secret, "{t}.{raw request body}")  ->  lowercase hex
```

Where `t` is the number from the header. Two things people get wrong:

1. **Use the raw bytes of the body.** If you parse the JSON and re-serialize it,
   key order and whitespace change and the signature will not match. Read the
   body as a string first, verify, then parse.
2. **Check the age.** Reject anything where `|now - t|` is more than 300
   seconds. Without it, someone who captures one delivery can replay it forever.
   `t` is inside the signed string, so it cannot be edited without breaking `v1`.

Compare with a constant-time function if your language has one.

### In a few languages we don't ship

PHP:

```php
[$t, $v1] = sscanf($_SERVER['HTTP_X_TDL_SIGNATURE'], "t=%d,v1=%s");
$raw = file_get_contents('php://input');
$expected = hash_hmac('sha256', "$t.$raw", $secret);

if (abs(time() - $t) > 300 || !hash_equals($expected, $v1)) {
    http_response_code(401);
    exit;
}
```

Elixir:

```elixir
[t, v1] = Regex.run(~r/t=(\d+),v1=([a-f0-9]+)/, header, capture: :all_but_first)
expected = :crypto.mac(:hmac, :sha256, secret, "#{t}.#{raw}") |> Base.encode16(case: :lower)

valid? = abs(System.system_time(:second) - String.to_integer(t)) <= 300 and
         Plug.Crypto.secure_compare(expected, v1)
```

Shell, useful for debugging a delivery by hand:

```bash
printf '%s.%s' "$T" "$RAW_BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1
```

### Checking your work

[`test-vectors.json`](test-vectors.json) has a fixed secret, timestamp, body,
and the signature they produce. If your implementation reproduces it, you are
done.

Every official SDK is held to that same file in its own CI, which is how we know
a Go integration and a Ruby one accept and reject exactly the same deliveries.

## Rate limits and errors

| Endpoint | Limit |
| --- | --- |
| `GET /v1/listing` | 60 per minute |
| `GET /v1/votes/check` | 120 per minute |
| `GET /v1/votes` | 60 per minute |
| `POST /bots/:slug/stats` | 30 per minute |

Limits are per token. Errors come back as `{"error": "..."}`:

| Code | What it means |
| --- | --- |
| 400 | The request was malformed. The message says how. |
| 401 | No `Authorization` header. |
| 403 | Token is wrong, revoked, or belongs to another listing. |
| 404 | No such listing, or it is not public. |
| 429 | Slow down and retry after the window. |