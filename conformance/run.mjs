import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { verifySignature } = require("../index.js");
const v = JSON.parse(readFileSync(new URL("../test-vectors.json", import.meta.url), "utf8"));
const now = v.timestamp;

console.log(JSON.stringify({
  invalidSig: verifySignature(v.secret, v.invalidSignatureHeader, v.body, { now }),
  malformed: verifySignature(v.secret, "garbage", v.body, { now }),
  staleAcceptedNoTolerance: verifySignature(v.secret, v.staleButValidHeader, v.body, { now, toleranceSeconds: 0 }),
  staleRejected: verifySignature(v.secret, v.staleButValidHeader, v.body, { now }),
  staleTs: verifySignature(v.secret, v.staleTimestampHeader, v.body, { now }),
  tamperedBody: verifySignature(v.secret, v.signatureHeader, v.body + " ", { now }),
  valid: verifySignature(v.secret, v.signatureHeader, v.body, { now }),
  wrongSecret: verifySignature("whsec_wrong", v.signatureHeader, v.body, { now }),
}));
