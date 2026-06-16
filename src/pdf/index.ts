/**
 * `divyastroapi/pdf` — turn DivyAstroAPI report JSON into branded, print-ready
 * PDFs (or HTML).
 *
 * Two layers:
 *  1. `render*Html(data, branding?)` — pure, zero-dependency functions that
 *     turn the JSON from `client.reports.*` into a self-contained, branded
 *     HTML document. Run anywhere (Node, edge, browser).
 *  2. `htmlToPdf(html, opts?)` + the `*Pdf(...)` convenience wrappers —
 *     produce PDF bytes via the optional `puppeteer` peer dependency.
 *
 * @example
 * ```ts
 * import { DivyAstro } from "divyastroapi";
 * import { kundliDetailedPdf } from "divyastroapi/pdf";
 *
 * const client = new DivyAstro({ apiKey: process.env.DIVYASTRO_API_KEY });
 * const report = await client.reports.kundliDetailed({
 *   date: "1990-01-15", time: "10:30", tz: "Asia/Kolkata", lat: 19.07, lon: 72.87,
 * });
 * const pdf = await kundliDetailedPdf(report, {
 *   branding: { companyName: "Acme Astro", logoUrl: "https://…/logo.png", primaryColor: "#6b21a8" },
 * });
 * ```
 */
import { renderKundliLiteHtml } from "./templates/kundliLite.js";
import { renderKundliDetailedHtml } from "./templates/kundliDetailed.js";
import { renderKundliBrihadHtml } from "./templates/kundliBrihad.js";
import { renderMatchMakingHtml } from "./templates/matchMaking.js";
import { renderDashaAnalysisHtml } from "./templates/dashaAnalysis.js";
import { renderNumerologyHtml } from "./templates/numerology.js";
import { renderSadeSatiHtml } from "./templates/sadeSati.js";
import { renderVarshaphalHtml } from "./templates/varshaphal.js";
import { renderHoroscopeHtml } from "./templates/horoscope.js";
import { htmlToPdf, type HtmlToPdfOptions } from "./render.js";
import type { Branding } from "./shared.js";

// ── Branding + HTML helpers ────────────────────────────────────────────────
export type { Branding, RawBranding, ResolvedBranding } from "./shared.js";
export { resolveBranding, esc } from "./shared.js";

// ── HTML renderers (zero-dependency) ────────────────────────────────────────
export { renderKundliLiteHtml, type KundliLiteData } from "./templates/kundliLite.js";
export { renderKundliDetailedHtml, type KundliDetailedData } from "./templates/kundliDetailed.js";
export { renderKundliBrihadHtml, type KundliBrihadData } from "./templates/kundliBrihad.js";
export { renderMatchMakingHtml, type MatchMakingData } from "./templates/matchMaking.js";
export { renderDashaAnalysisHtml, type DashaAnalysisData } from "./templates/dashaAnalysis.js";
export { renderNumerologyHtml, type NumerologyData } from "./templates/numerology.js";
export { renderSadeSatiHtml, type SadeSatiData } from "./templates/sadeSati.js";
export { renderVarshaphalHtml, type VarshaphalData } from "./templates/varshaphal.js";
export { renderHoroscopeHtml, type HoroscopeData } from "./templates/horoscope.js";

// ── PDF rendering (optional puppeteer) ──────────────────────────────────────
export { htmlToPdf } from "./render.js";
export type { HtmlToPdfOptions, PuppeteerBrowserLike, PuppeteerModuleLike } from "./render.js";

/** Options for the one-call `*Pdf` convenience wrappers. */
export type ReportPdfOptions = HtmlToPdfOptions & {
  /** Branding overrides (logo, colors, company name, footer, watermark). */
  branding?: Branding;
};

/** Build a PDF from a single `render*Html` function + report data. */
function toPdf<D>(
  render: (data: D, branding?: Branding) => string,
  data: D,
  opts?: ReportPdfOptions,
): Promise<Uint8Array> {
  return htmlToPdf(render(data, opts?.branding), opts);
}

/** Detailed Kundli → PDF. */
export const kundliDetailedPdf = (data: Parameters<typeof renderKundliDetailedHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderKundliDetailedHtml, data, opts);
/** Lite Kundli → PDF. */
export const kundliLitePdf = (data: Parameters<typeof renderKundliLiteHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderKundliLiteHtml, data, opts);
/** Brihad (comprehensive) Kundli → PDF. */
export const kundliBrihadPdf = (data: Parameters<typeof renderKundliBrihadHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderKundliBrihadHtml, data, opts);
/** Match-making (Kundli Milan) → PDF. */
export const matchMakingPdf = (data: Parameters<typeof renderMatchMakingHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderMatchMakingHtml, data, opts);
/** Dasha analysis → PDF. */
export const dashaAnalysisPdf = (data: Parameters<typeof renderDashaAnalysisHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderDashaAnalysisHtml, data, opts);
/** Numerology → PDF. */
export const numerologyPdf = (data: Parameters<typeof renderNumerologyHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderNumerologyHtml, data, opts);
/** Sade Sati → PDF. */
export const sadeSatiPdf = (data: Parameters<typeof renderSadeSatiHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderSadeSatiHtml, data, opts);
/** Varshaphal (annual) → PDF. */
export const varshaphalPdf = (data: Parameters<typeof renderVarshaphalHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderVarshaphalHtml, data, opts);
/** Horoscope (daily/weekly/monthly) → PDF. */
export const horoscopePdf = (data: Parameters<typeof renderHoroscopeHtml>[0], opts?: ReportPdfOptions) =>
  toPdf(renderHoroscopeHtml, data, opts);
