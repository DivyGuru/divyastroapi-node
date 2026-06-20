/**
 * Shared request/response types for the DivyAstroAPI SDK.
 *
 * Response payloads (`data`) are intentionally typed as `unknown` at the SDK
 * boundary: the API surfaces ~270 distinct response shapes and they evolve
 * independently of this client. Pass a type parameter to any call to narrow
 * it yourself, e.g. `client.chart.planets<MyPlanetsShape>(birth)`.
 */

/** Diagnostic metadata attached to every successful response envelope. */
export interface ResponseMeta {
  request_id?: string;
  computed_at?: string;
  cache?: "hit" | "miss" | (string & {});
  tier?: string;
  [key: string]: unknown;
}

/** Every successful API response is wrapped in `{ data, meta }`. */
export interface ResponseEnvelope<T = unknown> {
  data: T;
  meta?: ResponseMeta;
}

/** Sidereal ayanamsha systems supported by the API. */
export type Ayanamsa =
  | "lahiri"
  | "krishnamurti"
  | "raman"
  | "fagan"
  | "yukteshwar"
  | "true_chitrapaksha";

/** House systems supported by the API. */
export type HouseSystem =
  | "whole-sign"
  | "equal"
  | "placidus"
  | "koch"
  | "porphyry"
  | "campanus"
  | "regiomontanus";

/** Narrative / horoscope response languages. */
export type Locale = "en" | "hi" | "mr" | "bn" | "kn" | "ta" | "te" | "gu";

/**
 * A birth (or event) moment with a fixed location. `date`/`time`/`tz` describe
 * the civil moment; `lat`/`lon` the observer.
 */
export interface BirthInput {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** 24-hour time, `HH:MM`. */
  time: string;
  /** IANA name (`Asia/Kolkata`) or fixed offset (`+05:30`). */
  tz: string;
  /** Latitude in decimal degrees, north positive. */
  lat: number;
  /** Longitude in decimal degrees, east positive. */
  lon: number;
}

/**
 * A moment + location for panchang-style queries. `date`/`time` are optional —
 * the server defaults to "now" in the given `tz` when omitted.
 */
export interface MomentInput {
  /** Latitude in decimal degrees, north positive. */
  lat: number;
  /** Longitude in decimal degrees, east positive. */
  lon: number;
  /** IANA name (`Asia/Kolkata`) or fixed offset (`+05:30`). */
  tz: string;
  /** ISO date, `YYYY-MM-DD`. Defaults to today in `tz`. */
  date?: string;
  /** 24-hour time, `HH:MM`. */
  time?: string;
}

/** Calculation settings accepted by most Vedic moment endpoints. */
export interface VedicMomentSettings {
  ayanamsa?: Ayanamsa;
}

/** Calculation settings accepted by most Vedic birth-chart endpoints. */
export interface VedicBirthSettings {
  ayanamsa?: Ayanamsa;
  houseSystem?: HouseSystem;
}

/** Two birth charts for Vedic matchmaking (`boy` = groom, `girl` = bride). */
export interface BoyGirlInput {
  boy: BirthInput;
  girl: BirthInput;
}

/** Two birth charts for Western synastry / composite work. */
export interface TwoPersonInput {
  personA: BirthInput;
  personB: BirthInput;
}

/** Horoscope-by-sign input. `rashi` is case-insensitive (English or Hindi). */
export interface RashiInput {
  rashi: string;
  date?: string;
  lang?: Locale;
}

/** Numerology input. Provide `name` and/or `dob` depending on the number. */
export interface NumerologyInput {
  /** Full name as written on official documents. */
  name?: string;
  /** Date of birth, `YYYY-MM-DD`. */
  dob?: string;
  lang?: Locale;
}

/** A `[startDate, endDate]` window (`YYYY-MM-DD`). */
export interface DateRangeInput {
  startDate: string;
  endDate: string;
}

/** A Western natal chart input (tropical). */
export interface WesternNatalInput extends BirthInput {
  houseSystem?: HouseSystem;
}

/** A Western transit moment (no location needed). */
export interface WesternMomentInput {
  date: string;
  time: string;
  tz: string;
}

/** A muhurta search: a location plus a `[startDate, endDate]` window. */
export interface MuhurtaInput {
  lat: number;
  lon: number;
  tz: string;
  startDate: string;
  endDate: string;
}

/**
 * A natal chart plus a separate transit moment — used by transits-to-natal
 * style endpoints. `birth` is the natal data; `date`/`time`/`tz` describe the
 * moment whose transits are evaluated against it.
 */
export interface NatalTransitInput {
  birth: BirthInput;
  /** Transit date, `YYYY-MM-DD`. */
  date: string;
  /** Transit time, `HH:MM`. */
  time: string;
  /** Transit timezone (IANA or fixed offset). */
  tz: string;
}

/** Low-level query value. */
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;
