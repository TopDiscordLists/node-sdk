import crypto from "node:crypto";

export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface VerifyOptions {
    toleranceSeconds?: number;
    now?: number;
}

function parseHeader(
    header: string
): { timestamp: number; signature: string } | null {
    const match = header.match(/^t=(\d+),v1=([a-f0-9]+)$/);

    if (!match) {
        return null;
    }

    return {
        timestamp: Number(match[1]),
        signature: match[2]!
    };
}

export function sign(
    secret: string,
    timestamp: number,
    rawBody: string | Buffer
): string {
    return crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody.toString()}`)
        .digest("hex");
}

/**
 * Verify an X-TDL-Signature header against the raw request body.
 *
 * A tolerance of 0 disables the timestamp age check.
 */
export function verifySignature(
    secret: string,
    header: string | null | undefined,
    rawBody: string | Buffer,
    options: VerifyOptions = {}
): boolean {
    try {
        if (typeof header !== "string") {
            return false;
        }

        const parsed = parseHeader(header);

        if (!parsed) {
            return false;
        }

        const tolerance =
            options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

        const now =
            options.now ?? Math.floor(Date.now() / 1000);

        if (
            tolerance > 0 &&
            Math.abs(now - parsed.timestamp) > tolerance
        ) {
            return false;
        }

        const expected = sign(secret, parsed.timestamp, rawBody);

        const expectedBuffer = Buffer.from(expected, "utf8");
        const providedBuffer = Buffer.from(parsed.signature, "utf8");

        if (expectedBuffer.length !== providedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    } catch {
        return false;
    }
}
