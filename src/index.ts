/**
 * divyastroapi — official Node.js / TypeScript SDK for DivyAstroAPI.
 *
 * @packageDocumentation
 */
export { DivyAstro, VERSION } from "./client.js";
export type { DivyAstroOptions, ClientCore } from "./client.js";
export type { RequestOptions, FetchLike } from "./http.js";

export {
  DivyAstroError,
  DivyAstroConnectionError,
  BadRequestError,
  AuthenticationError,
  PaymentRequiredError,
  PermissionError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from "./errors.js";
export type { ApiErrorBody } from "./errors.js";

export type {
  ResponseEnvelope,
  ResponseMeta,
  Ayanamsa,
  HouseSystem,
  Locale,
  BirthInput,
  MomentInput,
  BoyGirlInput,
  TwoPersonInput,
  RashiInput,
  NumerologyInput,
  DateRangeInput,
  WesternNatalInput,
  WesternMomentInput,
  MuhurtaInput,
  NatalTransitInput,
  VedicMomentSettings,
  VedicBirthSettings,
  QueryParams,
  QueryValue,
} from "./types.js";

// The DivyAstro class is also the default export for convenience.
import { DivyAstro } from "./client.js";
export default DivyAstro;
