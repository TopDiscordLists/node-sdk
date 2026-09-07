import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { verifySignature } = require(join(root, "dist", "index.js"));

const v = JSON.parse(readFileSync(join(root, "test-vectors.json"), "utf8"));
const now = v.timestamp;

const results = {
    invalidSig: verifySignature(v.secret, v.invalidSignatureHeader, v.body, { now }),
    malformed: verifySignature(v.secret, "garbage", v.body, { now }),
    staleAcceptedNoTolerance: verifySignature(v.secret, v.staleButValidHeader, v.body, { now, toleranceSeconds: 0 }),
    staleRejected: verifySignature(v.secret, v.staleButValidHeader, v.body, { now }),
    staleTs: verifySignature(v.secret, v.staleTimestampHeader, v.body, { now }),
    tamperedBody: verifySignature(v.secret, v.signatureHeader, v.body + " ", { now }),
    valid: verifySignature(v.secret, v.signatureHeader, v.body, { now }),
    wrongSecret: verifySignature("whsec_wrong", v.signatureHeader, v.body, { now })
};

console.log(JSON.stringify(results, Object.keys(results).sort()));
