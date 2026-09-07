export declare const DEFAULT_TOLERANCE_SECONDS = 300;
export interface VerifyOptions {
    toleranceSeconds?: number;
    now?: number;
}
export declare function sign(secret: string, timestamp: number, rawBody: string | Buffer): string;
/**
 * Verify an X-TDL-Signature header against the raw request body.
 *
 * A tolerance of 0 disables the timestamp age check.
 */
export declare function verifySignature(secret: string, header: string | null | undefined, rawBody: string | Buffer, options?: VerifyOptions): boolean;
