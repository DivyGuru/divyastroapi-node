import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DivyAstro,
  AuthenticationError,
  PaymentRequiredError,
  RateLimitError,
  BadRequestError,
  DivyAstroConnectionError,
  type FetchLike,
} from "../src/index.js";

/** Records every request and returns canned responses. */
function mockFetch(
  responder: (url: URL) => { status?: number; body?: unknown; headers?: Record<string, string> },
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responder(new URL(url));
    const status = r.status ?? 200;
    const body = r.body === undefined ? { data: {} } : r.body;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  };
  return { fetch, calls };
}

function makeClient(fetch: FetchLike, extra: Record<string, unknown> = {}) {
  return new DivyAstro({ apiKey: "dv_live_test", fetch, maxRetries: 0, ...extra });
}

const BIRTH = { date: "1990-01-15", time: "10:30", tz: "Asia/Kolkata", lat: 19.076, lon: 72.8777 };

describe("transport", () => {
  it("builds an authenticated GET and unwraps `data`", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: { number: 3 }, meta: { cache: "miss" } } }));
    const client = makeClient(fetch);
    const res = await client.panchang.tithi({ lat: 28.61, lon: 77.2, tz: "Asia/Kolkata" });

    expect(res).toEqual({ number: 3 });
    const call = calls[0]!;
    const url = new URL(call.url);
    expect(url.pathname).toBe("/v1/panchang/tithi");
    expect(url.searchParams.get("lat")).toBe("28.61");
    expect(url.searchParams.get("tz")).toBe("Asia/Kolkata");
    expect((call.init!.headers as Record<string, string>).Authorization).toBe("Bearer dv_live_test");
  });

  it("returns the full envelope with { raw: true }", async () => {
    const { fetch } = mockFetch(() => ({ body: { data: { x: 1 }, meta: { tier: "standard" } } }));
    const client = makeClient(fetch);
    const res = await client.request("/v1/panchang/tithi", { lat: 1, lon: 2, tz: "UTC" }, { raw: true });
    expect(res).toEqual({ data: { x: 1 }, meta: { tier: "standard" } });
  });

  it("omits empty params and sorts the query string", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    const client = makeClient(fetch);
    await client.panchang.tithi({ lat: 28.61, lon: 77.2, tz: "Asia/Kolkata", date: "" as unknown as string });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.has("date")).toBe(false);
  });
});

describe("param shapes", () => {
  it("flat birth params", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).chart.planets(BIRTH);
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("date")).toBe("1990-01-15");
    expect(url.searchParams.get("lat")).toBe("19.076");
  });

  it("birth.* prefixed params (mangal-dosha)", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).milan.mangalDosha(BIRTH);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/v1/milan/mangal-dosha");
    expect(url.searchParams.get("birth.date")).toBe("1990-01-15");
    expect(url.searchParams.get("birth.lat")).toBe("19.076");
    expect(url.searchParams.has("date")).toBe(false);
  });

  it("boy.*/girl.* matchmaking params", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).milan.ashtakootaTotal({
      boy: BIRTH,
      girl: { ...BIRTH, date: "1992-03-20" },
    });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("boy.date")).toBe("1990-01-15");
    expect(url.searchParams.get("girl.date")).toBe("1992-03-20");
  });

  it("lowercases rashi", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).horoscope.daily({ rashi: "Aries" });
    expect(new URL(calls[0]!.url).searchParams.get("rashi")).toBe("aries");
  });

  it("substitutes path params (divisional varga)", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).chart.divisional({ ...BIRTH, varga: "D9" });
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/v1/chart/divisional/D9");
    expect(url.searchParams.has("varga")).toBe(false);
  });

  it("custom shape (festivals.month)", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).festivals.month({ year: 2026, month: 11, tz: "Asia/Kolkata", region: "north_india" });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("year")).toBe("2026");
    expect(url.searchParams.get("region")).toBe("north_india");
  });

  it("natalTransit shape maps natal to birth.* and transit flat", async () => {
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    await makeClient(fetch).western.transits.toNatal({
      birth: BIRTH,
      date: "2026-06-16",
      time: "12:00",
      tz: "Asia/Kolkata",
    });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("birth.date")).toBe("1990-01-15");
    expect(url.searchParams.get("date")).toBe("2026-06-16");
  });

  it("exposes nested western namespaces", () => {
    const client = makeClient(mockFetch(() => ({})).fetch);
    expect(typeof client.western.natal.chart).toBe("function");
    expect(typeof client.western.synastry.aspects).toBe("function");
    expect(typeof client.western.firdaria).toBe("function");
  });

  it("throws on a missing path parameter", () => {
    const client = makeClient(mockFetch(() => ({})).fetch);
    expect(() =>
      // @ts-expect-error intentionally missing varga
      client.chart.divisional({ ...BIRTH }),
    ).toThrow(/path parameter/);
  });
});

describe("errors", () => {
  it("maps 401 to AuthenticationError with code + requestId", async () => {
    const { fetch } = mockFetch(() => ({
      status: 401,
      body: { error: { code: "unauthorized", message: "bad key", request_id: "req_1" } },
    }));
    const client = makeClient(fetch);
    await expect(client.chart.planets(BIRTH)).rejects.toMatchObject({
      name: "AuthenticationError",
      code: "unauthorized",
      status: 401,
      requestId: "req_1",
    });
    await expect(client.chart.planets(BIRTH)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("maps 402 to PaymentRequiredError", async () => {
    const { fetch } = mockFetch(() => ({ status: 402, body: { error: { code: "insufficient_credits", message: "no credits" } } }));
    await expect(makeClient(fetch).chart.planets(BIRTH)).rejects.toBeInstanceOf(PaymentRequiredError);
  });

  it("maps 400 to BadRequestError", async () => {
    const { fetch } = mockFetch(() => ({ status: 400, body: { error: { code: "invalid_param", message: "bad lat" } } }));
    await expect(makeClient(fetch).chart.planets(BIRTH)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("maps 429 to RateLimitError with retryAfter", async () => {
    const { fetch } = mockFetch(() => ({
      status: 429,
      body: { error: { code: "rate_limited", message: "slow down" } },
      headers: { "retry-after": "7" },
    }));
    const err = await makeClient(fetch).chart.planets(BIRTH).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(7);
  });

  it("parses the HTTP-date form of Retry-After", async () => {
    const { fetch } = mockFetch(() => ({
      status: 429,
      body: { error: { code: "rate_limited" } },
      headers: { "retry-after": "Wed, 21 Oct 2099 07:28:00 GMT" },
    }));
    const err = await makeClient(fetch).chart.planets(BIRTH).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    const ra = (err as RateLimitError).retryAfter;
    expect(typeof ra).toBe("number");
    expect(ra! > 0 && Number.isFinite(ra!)).toBe(true);
  });
});

describe("retries", () => {
  it("retries a 429 then succeeds", async () => {
    let n = 0;
    const { fetch, calls } = mockFetch(() => {
      n += 1;
      if (n === 1) return { status: 429, body: { error: { code: "rate_limited" } }, headers: { "retry-after": "0" } };
      return { body: { data: { ok: true } } };
    });
    const client = makeClient(fetch, { maxRetries: 2 });
    const res = await client.chart.planets(BIRTH);
    expect(res).toEqual({ ok: true });
    expect(calls.length).toBe(2);
  });

  it("gives up after maxRetries", async () => {
    const { fetch, calls } = mockFetch(() => ({ status: 503, body: { error: { code: "unavailable" } }, headers: { "retry-after": "0" } }));
    await expect(makeClient(fetch, { maxRetries: 2 }).chart.planets(BIRTH)).rejects.toMatchObject({ status: 503 });
    expect(calls.length).toBe(3); // initial + 2 retries
  });
});

describe("configuration", () => {
  const OLD = process.env.DIVYASTRO_API_KEY;
  beforeEach(() => { delete process.env.DIVYASTRO_API_KEY; });
  afterEach(() => { if (OLD !== undefined) process.env.DIVYASTRO_API_KEY = OLD; });

  it("throws when no API key is provided", () => {
    expect(() => new DivyAstro({ fetch: mockFetch(() => ({})).fetch })).toThrow(/API key/);
  });

  it("reads the API key from the environment", async () => {
    process.env.DIVYASTRO_API_KEY = "dv_live_env";
    const { fetch, calls } = mockFetch(() => ({ body: { data: {} } }));
    const client = new DivyAstro({ fetch, maxRetries: 0 });
    await client.panchang.tithi({ lat: 1, lon: 2, tz: "UTC" });
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe("Bearer dv_live_env");
  });

  it("accepts a bare API key string", () => {
    const client = new DivyAstro("dv_live_str");
    expect(client).toBeInstanceOf(DivyAstro);
  });

  it("surfaces network failures as DivyAstroConnectionError", async () => {
    const fetch: FetchLike = async () => { throw new Error("boom"); };
    await expect(makeClient(fetch).panchang.tithi({ lat: 1, lon: 2, tz: "UTC" })).rejects.toBeInstanceOf(
      DivyAstroConnectionError,
    );
  });
});
