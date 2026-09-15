type Browser = import('puppeteer-core').Browser;

/**
 * Native `import()` that survives compilation. With `"module": "commonjs"`,
 * tsc rewrites `await import('x')` into `require('x')`, which throws
 * ERR_REQUIRE_ESM on `@sparticuz/chromium`, `puppeteer-core` and `puppeteer`
 * (all ESM-only). Building the call through `new Function` hides it from tsc.
 */
const importEsm = new Function('specifier', 'return import(specifier)') as <T>(
  specifier: string,
) => Promise<T>;

/**
 * Renders an HTML document to a PDF buffer via headless Chromium.
 *
 * Two code paths on purpose: `@sparticuz/chromium` ships a Lambda/Vercel-sized
 * Chromium binary but has no browser to fall back to locally, while the full
 * `puppeteer` package bundles its own Chromium for local development but is
 * far too large to deploy. `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME` reliably tells
 * the two environments apart.
 */
async function launchBrowser(): Promise<Browser> {
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    // Static `require.resolve` calls so Vercel's file tracer still bundles
    // these packages — it can't see through the `importEsm` indirection.
    require.resolve('@sparticuz/chromium');
    require.resolve('puppeteer-core');

    const { default: chromium } =
      await importEsm<typeof import('@sparticuz/chromium')>('@sparticuz/chromium');
    const puppeteer =
      await importEsm<typeof import('puppeteer-core')>('puppeteer-core');
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local dev: the full `puppeteer` Browser satisfies the same
  // puppeteer-core surface.
  const puppeteerFull = await importEsm<typeof import('puppeteer')>('puppeteer');
  return (await puppeteerFull.launch({ headless: true })) as unknown as Browser;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // `setContent`'s waitUntil no longer accepts networkidle0 — the Google
    // Fonts <link> and the embedded logo data URI are all that's async here,
    // and 'load' already waits for those.
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
