/**
 * Error types thrown by the DivyAstroAPI SDK.
 *
 * Every non-2xx response is mapped to a {@link DivyAstroError} (or a more
 * specific subclass) carrying the API's `code`, the HTTP `status`, and the
 * `request_id` so support can correlate. Network / timeout failures throw
 * {@link DivyAstroConnectionError}.
 */

/** Shape of the API's error body: `{ "error": { code, message, request_id } }`. */
export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
}

export interface DivyAstroErrorOptions {
  code: string;
  status: number;
  requestId?: string;
  body?: unknown;
  cause?: unknown;
}

/** Base class for all errors surfaced by the SDK. */
export class DivyAstroError extends Error {
  /** Machine-readable API error code, e.g. `insufficient_credits`. */
  readonly code: string;
  /** HTTP status code (0 for network/timeout failures). */
  readonly status: number;
  /** API request id, when present — quote this to support. */
  readonly requestId?: string;
  /** Raw parsed response body, when available. */
  readonly body?: unknown;

  constructor(message: string, opts: DivyAstroErrorOptions) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.body = opts.body;
    // Restore prototype chain for ES5 transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 — a query parameter was missing, malformed, or out of range. */
export class BadRequestError extends DivyAstroError {}
/** 401 — missing or invalid API key. */
export class AuthenticationError extends DivyAstroError {}
/** 402 — out of credits / trial exhausted / payment required. */
export class PaymentRequiredError extends DivyAstroError {}
/** 403 — key valid but not permitted (tier, IP allow-list, suspended). */
export class PermissionError extends DivyAstroError {}
/** 404 — unknown path or sub-resource. */
export class NotFoundError extends DivyAstroError {}
/** 429 — rate limit or daily quota exceeded. `retryAfter` is in seconds. */
export class RateLimitError extends DivyAstroError {
  readonly retryAfter?: number;
  constructor(message: string, opts: DivyAstroErrorOptions & { retryAfter?: number }) {
    super(message, opts);
    this.retryAfter = opts.retryAfter;
  }
}
/** 5xx — server-side failure. */
export class ServerError extends DivyAstroError {}
/** Network failure, DNS error, or request timeout (no HTTP status). */
export class DivyAstroConnectionError extends DivyAstroError {
  constructor(message: string, opts?: { cause?: unknown; code?: string }) {
    super(message, { code: opts?.code ?? "connection_error", status: 0, cause: opts?.cause });
  }
}

/**
 * Build the right error subclass from an HTTP status + parsed body.
 * @internal
 */
export function errorFromResponse(
  status: number,
  body: unknown,
  retryAfter?: number,
): DivyAstroError {
  const parsed = (body && typeof body === "object" ? (body as ApiErrorBody) : {}).error;
  const code = parsed?.code ?? httpStatusCode(status);
  const message = parsed?.message ?? `HTTP ${status}`;
  const requestId = parsed?.request_id;
  const opts: DivyAstroErrorOptions = { code, status, requestId, body };

  switch (status) {
    case 400:
      return new BadRequestError(message, opts);
    case 401:
      return new AuthenticationError(message, opts);
    case 402:
      return new PaymentRequiredError(message, opts);
    case 403:
      return new PermissionError(message, opts);
    case 404:
      return new NotFoundError(message, opts);
    case 429:
      return new RateLimitError(message, { ...opts, retryAfter });
    default:
      if (status >= 500) return new ServerError(message, opts);
      return new DivyAstroError(message, opts);
  }
}

function httpStatusCode(status: number): string {
  if (status === 0) return "connection_error";
  if (status >= 500) return "internal_error";
  if (status >= 400) return "bad_request";
  return "error";
}
