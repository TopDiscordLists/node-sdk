export declare class APIError extends Error {
    readonly status: number;
    constructor(message: string, status: number);
}
