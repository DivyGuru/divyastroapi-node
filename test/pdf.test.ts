import { describe, it, expect } from "vitest";
import {
  renderKundliDetailedHtml,
  renderKundliLiteHtml,
  renderKundliBrihadHtml,
  renderMatchMakingHtml,
  renderDashaAnalysisHtml,
  renderNumerologyHtml,
  renderSadeSatiHtml,
  renderVarshaphalHtml,
  renderHoroscopeHtml,
  htmlToPdf,
  type Branding,
} from "../src/pdf/index.js";

const BRANDING: Branding = {
  companyName: "Acme Astro",
  logoUrl: "https://cdn.example/acme/logo.png",
  primaryColor: "#6b21a8",
  secondaryColor: "#9333ea",
  footerText: "Acme Astro · confidential",
  watermarkText: "SAMPLE",
};

const PLACEMENT = { sign: "Leo", dms_within: "06°00'21\"", nakshatra: "Magha", pada: 2, nak_lord: "Ketu" };

// Minimal-but-valid fixtures keyed exactly as the API emits them.
const kundliDetailed = {
  Locale: "en",
  Subject: { Name: "Test Native", BirthDate: "1990-01-15", BirthTime: "10:30 IST", BirthPlace: "Mumbai" },
  Ascendant: PLACEMENT,
  Planets: [{ name: "Sun", placement: PLACEMENT, house_num: 11, retro: false }],
  Panchang: { tithi: "Shukla Tritiya", nakshatra: "Magha", yoga: "Vajra", karana: "Taitila" },
  Narratives: [{ Heading: "Leo Lagna", Body: "Sun-led temperament.", Bullets: ["Leadership"], Citations: ["BPHS"] }],
};

const fixtures: Array<{ name: string; fn: (d: any, b?: Branding) => string; data: any }> = [
  { name: "kundliDetailed", fn: renderKundliDetailedHtml, data: kundliDetailed },
  { name: "kundliLite", fn: renderKundliLiteHtml, data: { Locale: "en", Subject: { Name: "T" }, Ascendant: PLACEMENT, Planets: [{ name: "Sun", placement: PLACEMENT, house_num: 1, retro: false }] } },
  { name: "kundliBrihad", fn: renderKundliBrihadHtml, data: { Locale: "en", Subject: { Name: "T" }, Ascendant: PLACEMENT, Planets: [{ name: "Sun", placement: PLACEMENT, house_num: 1, retro: false }] } },
  { name: "matchMaking", fn: renderMatchMakingHtml, data: { Locale: "en", Boy: { name: "Boy" }, Girl: { name: "Girl" }, Ashtakoota: { Total: 28, Max: 36 } } },
  { name: "dashaAnalysis", fn: renderDashaAnalysisHtml, data: { Locale: "en", Subject: { Name: "T" }, AllMahadashas: [{ Lord: "Ketu", StartDate: "1990", DurationY: 7 }] } },
  { name: "numerology", fn: renderNumerologyHtml, data: { dob: "1990-01-15", driver: 6, conductor: 8 } },
  { name: "sadeSati", fn: renderSadeSatiHtml, data: { Locale: "en", Subject: { Name: "T" } } },
  { name: "varshaphal", fn: renderVarshaphalHtml, data: { Locale: "en", Subject: { Name: "T" }, TargetYear: 2026, Ascendant: PLACEMENT, Planets: [{ name: "Sun", placement: PLACEMENT, house_num: 1, retro: false }], Muntha: { sign: "Leo", house: 1 } } },
  { name: "horoscope", fn: renderHoroscopeHtml, data: { rashi: "Aries", rashi_label: "Aries", period: "daily", period_key: "2026-06-07", language: "en", headline: "Good day", slow_movers: [{ planet: "Jupiter", current_sign: "Cancer", heading: "Jupiter transit", body: "Favorable." }], lucky: { color: "Red", number: 9, direction: "East", time: "06:00-08:00" } } },
];

describe("report templates", () => {
  for (const { name, fn, data } of fixtures) {
    it(`${name} renders a complete branded HTML document`, () => {
      const html = fn(data, BRANDING);
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).toContain("</html>");
      // Branding applied:
      expect(html).toContain("--brand-primary: #6b21a8");
      expect(html).toContain("Acme Astro");
      expect(html).toContain("https://cdn.example/acme/logo.png");
      expect(html).toContain("SAMPLE"); // watermark
      expect(html).toContain("Acme Astro · confidential"); // footer
    });
  }

  it("works with no branding (system defaults)", () => {
    const html = renderKundliDetailedHtml(kundliDetailed);
    expect(html).toContain("--brand-primary: #1a1a1a");
    expect(html).toContain("Generated using DivyAstroAPI");
    expect(html).not.toContain("<img"); // no logo when none supplied
  });

  it("HTML-escapes data values (no injection)", () => {
    const html = renderKundliDetailedHtml({
      ...kundliDetailed,
      Subject: { ...kundliDetailed.Subject, Name: "<script>alert(1)</script>" },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes report data (planet, narrative)", () => {
    const html = renderKundliDetailedHtml(kundliDetailed);
    expect(html).toContain("Sun");
    expect(html).toContain("Leo Lagna");
    expect(html).toContain("Shukla Tritiya");
  });
});

describe("branding sanitization (security)", () => {
  it("rejects CSS-injection in colors and falls back to default", () => {
    const html = renderKundliDetailedHtml(kundliDetailed, {
      primaryColor: "red}body{display:none}*{color:red",
      secondaryColor: "blue;} @import url(http://evil)",
    });
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("@import");
    expect(html).toContain("--brand-primary: #1a1a1a"); // fell back
    expect(html).toContain("--brand-secondary: #666666");
  });

  it("accepts valid color forms (hex / named / rgb)", () => {
    expect(renderKundliDetailedHtml(kundliDetailed, { primaryColor: "#6b21a8" })).toContain("--brand-primary: #6b21a8");
    expect(renderKundliDetailedHtml(kundliDetailed, { primaryColor: "rebeccapurple" })).toContain("--brand-primary: rebeccapurple");
    expect(renderKundliDetailedHtml(kundliDetailed, { primaryColor: "rgb(107, 33, 168)" })).toContain("--brand-primary: rgb(107, 33, 168)");
  });

  it("drops dangerous logo URL schemes, keeps safe ones", () => {
    // dangerous → omitted (no <img>)
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "blob:http://x", "data:text/html,<script>"]) {
      expect(renderKundliDetailedHtml(kundliDetailed, { logoUrl: bad })).not.toContain("<img");
    }
    // safe → rendered
    expect(renderKundliDetailedHtml(kundliDetailed, { logoUrl: "https://cdn.x/logo.png" })).toContain(
      '<img src="https://cdn.x/logo.png"',
    );
    expect(renderKundliDetailedHtml(kundliDetailed, { logoUrl: "data:image/png;base64,iVBORw0" })).toContain("<img");
    expect(renderKundliDetailedHtml(kundliDetailed, { logoUrl: "//cdn.x/logo.png" })).toContain("<img");
  });

  it("neutralizes watermark CSS-string break-out (quote / backslash / </style>)", () => {
    const html = renderKundliDetailedHtml(kundliDetailed, { watermarkText: 'X"\\</style><b>' });
    // The raw breakout sequences must not appear; they're CSS-hex-escaped.
    expect(html).not.toContain('"X"\\');
    expect(html).not.toContain("</style><b>");
    expect(html).toContain("\\22 "); // escaped "
    expect(html).toContain("\\5c "); // escaped backslash
    expect(html).toContain("\\3c "); // escaped <
    // The watermark block's own declarations stay intact.
    expect(html).toContain("transform: translate(-50%, -50%) rotate(-30deg)");
  });
});

describe("htmlToPdf", () => {
  it("errors helpfully when puppeteer is unavailable", async () => {
    // puppeteer is an optional peer dep, not installed in CI.
    await expect(htmlToPdf("<!doctype html><html><body>x</body></html>")).rejects.toThrow(/Puppeteer/i);
  });

  it("uses an injected browser/puppeteer (no real Chromium)", async () => {
    let pdfCalled = false;
    const fakePage = {
      setContent: async () => {},
      pdf: async () => {
        pdfCalled = true;
        return new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      },
      close: async () => {},
    };
    const fakeBrowser = { newPage: async () => fakePage, close: async () => {} };
    const out = await htmlToPdf("<!doctype html><html></html>", { browser: fakeBrowser });
    expect(pdfCalled).toBe(true);
    expect(Array.from(out.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});
