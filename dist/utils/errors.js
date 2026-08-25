"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIError = void 0;
class APIError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = "APIError";
        this.status = status;
    }
}
exports.APIError = APIError;
