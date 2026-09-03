/**
 * Renders an HTML document to a PDF buffer via headless Chromium.
 *
 * Two code paths on purpose: `@sparticuz/chromium` ships a Lambda/Vercel-sized
 * Chromium binary but has no browser to fall back to locally, while the full
 * `puppeteer` package bundles its own Chromium for local development but is
 * far too large to deploy. `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME` reliably tells
 * the two environments apart.
 */
async function launchBrowser(): Promise<import('puppeteer-core').Browser> {
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    const { default: chromium } = await import('@sparticuz/chromium');
    const puppeteer = await import('puppeteer-core');
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local dev: no import type for the full `puppeteer` package's own Browser
  // is needed here since it satisfies the same puppeteer-core surface.
  const puppeteerFull = await import('puppeteer');
  return puppeteerFull.launch({
    headless: true,
  }) as unknown as Promise<import('puppeteer-core').Browser> as any;
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
