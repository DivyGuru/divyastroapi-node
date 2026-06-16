/**
 * Optional HTML → PDF rendering via Puppeteer (headless Chromium).
 *
 * Puppeteer is an OPTIONAL peer dependency — the core `divyastroapi` package
 * and all `render*Html` functions work with zero dependencies. Install
 * `puppeteer` (or pass your own via `{ puppeteer }` / a live `{ browser }`)
 * only if you want this module to produce PDF bytes for you.
 *
 * Chromium is the right engine here: it ships Noto fonts so Devanagari /
 * Tamil / Telugu / Bengali / Gujarati / Kannada render correctly, and it
 * handles the templates' CSS (gradients, tables, watermark, @page) faithfully.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Minimal structural type for a Puppeteer page. */
interface PageLike {
  setContent(html: string, opts?: any): Promise<void>;
  pdf(opts?: any): Promise<Uint8Array | Buffer>;
  close(): Promise<void>;
}
/** Minimal structural type for a Puppeteer browser. */
export interface PuppeteerBrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}
/** Minimal structural type for the puppeteer module. */
export interface PuppeteerModuleLike {
  launch(opts?: any): Promise<PuppeteerBrowserLike>;
}

export interface HtmlToPdfOptions {
  /** Paper size. Default "A4". */
  format?: "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid";
  /** Landscape orientation. Default false. */
  landscape?: boolean;
  /** Print CSS background colors/images. Default true (templates are branded). */
  printBackground?: boolean;
  /** Honour the template's own @page CSS size. Default true. */
  preferCSSPageSize?: boolean;
  /** Page margins, e.g. `{ top: "10mm" }`. */
  margin?: { top?: string; bottom?: string; left?: string; right?: string };
  /** Render scale (0.1–2). */
  scale?: number;
  /** Max time to wait for the page to settle, ms. Default 30000. */
  timeoutMs?: number;
  /**
   * Reuse an already-launched browser (recommended for servers — launching
   * Chromium per call is slow). When provided, it is NOT closed for you.
   */
  browser?: PuppeteerBrowserLike;
  /** Inject the puppeteer module (e.g. `puppeteer-core` + `@sparticuz/chromium` on serverless). */
  puppeteer?: PuppeteerModuleLike;
  /** Options forwarded to `puppeteer.launch()` when this module launches the browser. */
  launchOptions?: Record<string, unknown>;
}

async function loadPuppeteer(injected?: PuppeteerModuleLike): Promise<PuppeteerModuleLike> {
  if (injected) return injected;
  try {
    // Non-literal specifier so bundlers/tsc don't hard-require the optional dep.
    const name = "puppeteer";
    const mod: any = await import(/* @vite-ignore */ name);
    return (mod.default ?? mod) as PuppeteerModuleLike;
  } catch (cause) {
    throw new Error(
      "divyastroapi/pdf: PDF rendering requires Puppeteer. Install it with `npm install puppeteer`, " +
        "or pass your own via `htmlToPdf(html, { puppeteer })` or a live `{ browser }`.",
      { cause },
    );
  }
}

/**
 * Convert a complete HTML document (from any `render*Html` function) into PDF
 * bytes using headless Chromium.
 *
 * @example
 * ```ts
 * import { renderKundliDetailedHtml, htmlToPdf } from "divyastroapi/pdf";
 * const html = renderKundliDetailedHtml(report, { logoUrl, companyName });
 * const pdf = await htmlToPdf(html);          // Uint8Array
 * fs.writeFileSync("kundli.pdf", pdf);
 * ```
 */
export async function htmlToPdf(html: string, opts: HtmlToPdfOptions = {}): Promise<Uint8Array> {
  const ownBrowser = !opts.browser;
  const browser = opts.browser ?? (await (await loadPuppeteer(opts.puppeteer)).launch(opts.launchOptions));
  let page: PageLike | undefined;
  try {
    page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: opts.timeoutMs ?? 30_000,
    });
    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: opts.printBackground ?? true,
      preferCSSPageSize: opts.preferCSSPageSize ?? true,
      ...(opts.margin ? { margin: opts.margin } : {}),
      ...(opts.scale ? { scale: opts.scale } : {}),
    });
    return pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  } finally {
    if (page) await page.close().catch(() => {});
    if (ownBrowser) await browser.close().catch(() => {});
  }
}
