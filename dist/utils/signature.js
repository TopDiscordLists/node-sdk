"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TOLERANCE_SECONDS = void 0;
exports.sign = sign;
exports.verifySignature = verifySignature;
const node_crypto_1 = __importDefault(require("node:crypto"));
exports.DEFAULT_TOLERANCE_SECONDS = 300;
function parseHeader(header) {
    const match = header.match(/^t=(\d+),v1=([a-f0-9]+)$/);
    if (!match) {
        return null;
    }
    return {
        timestamp: Number(match[1]),
        signature: match[2]
    };
}
function sign(secret, timestamp, rawBody) {
    return node_crypto_1.default
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody.toString()}`)
        .digest("hex");
}
/**
 * Verify an X-TDL-Signature header against the raw request body.
 *
 * A tolerance of 0 disables the timestamp age check.
 */
function verifySignature(secret, header, rawBody, options = {}) {
    try {
        if (typeof header !== "string") {
            return false;
        }
        const parsed = parseHeader(header);
        if (!parsed) {
            return false;
        }
        const tolerance = options.toleranceSeconds ?? exports.DEFAULT_TOLERANCE_SECONDS;
        const now = options.now ?? Math.floor(Date.now() / 1000);
        if (tolerance > 0 &&
            Math.abs(now - parsed.timestamp) > tolerance) {
            return false;
        }
        const expected = sign(secret, parsed.timestamp, rawBody);
        const expectedBuffer = Buffer.from(expected, "utf8");
        const providedBuffer = Buffer.from(parsed.signature, "utf8");
        if (expectedBuffer.length !== providedBuffer.length) {
            return false;
        }
        return node_crypto_1.default.timingSafeEqual(expectedBuffer, providedBuffer);
    }
    catch {
        return false;
    }
}
