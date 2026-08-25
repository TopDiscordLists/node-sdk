export class APIError extends Error {
    public readonly status: number;

    constructor(message: string, status: number) {
        super(message);

        this.name = "APIError";
        this.status = status;
    }
}