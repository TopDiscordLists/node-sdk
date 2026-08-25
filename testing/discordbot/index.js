require("dotenv").config();

const express = require("express");
const {
    Client: DiscordClient,
    GatewayIntentBits
} = require("discord.js");

const {
    Client: TDLClient
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

/*
 * Health endpoint
 */
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        discord: discord.isReady(),
        timestamp: new Date().toISOString()
    });
});

/*
 * TopDiscordList webhook
 *
 * IMPORTANT:
 * Keep this route using express.raw().
 * The SDK needs the original request body to verify
 * the webhook signature.
 */
app.post(
    "/vote",
    express.raw({ type: "application/json" }),
    tdl.expressWebhook(async (payload) => {
        console.log("pong");

        if (payload.vote.isTest) {
            console.log("[TDL] Test vote received");
            return;
        }

        console.log(
            `[TDL] ${payload.user.username} voted!`
        );
    })
);

/*
 * Discord ready
 */
discord.once("ready", async (client) => {
    console.log(`Logged in as ${client.user.tag}`);

    /*
     * Test the SDK HTTP functions.
     */

    try {
        const listing = await tdl.getListing();

        console.log("[TDL] Listing:", listing);

        const votes = await tdl.getVotes();

        console.log("[TDL] Recent votes:", votes);

        const analytics = await tdl.getAnalytics();

        console.log("[TDL] Analytics:", analytics);

        /*
         * Test hasVoted with a Discord user ID.
         *
         * Replace this with an actual Discord ID
         * when you want to test it.
         */
        // const voteCheck = await tdl.hasVoted("123456789012345678");
        // console.log("[TDL] Vote check:", voteCheck);

        /*
         * Test posting stats.
         */
        await tdl.postStats({
            serverCount: client.guilds.cache.size,
            userCount: client.users.cache.size,
            shardCount: client.ws.shards.size
        });

        console.log("[TDL] Stats posted successfully.");
    } catch (error) {
        console.error("[TDL] SDK test failed:", error);
    }
});

/*
 * Start HTTP server
 */
app.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

/*
 * Login
 */
discord.login(process.env.DISCORD_TOKEN);