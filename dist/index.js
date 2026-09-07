"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TOLERANCE_SECONDS = exports.sign = exports.verifySignature = exports.Client = void 0;
var Client_js_1 = require("./lib/Client.js");
Object.defineProperty(exports, "Client", { enumerable: true, get: function () { return Client_js_1.Client; } });
var signature_js_1 = require("./utils/signature.js");
Object.defineProperty(exports, "verifySignature", { enumerable: true, get: function () { return signature_js_1.verifySignature; } });
Object.defineProperty(exports, "sign", { enumerable: true, get: function () { return signature_js_1.sign; } });
Object.defineProperty(exports, "DEFAULT_TOLERANCE_SECONDS", { enumerable: true, get: function () { return signature_js_1.DEFAULT_TOLERANCE_SECONDS; } });
