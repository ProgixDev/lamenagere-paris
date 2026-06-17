import type { IncomingMessage, ServerResponse } from 'http';

// Imports the COMPILED app (dist/serverless.js) — Vercel runs `npm run build`
// first, so tsc has already emitted the decorator metadata Nest needs.
// `require` (typed as any) avoids needing a .d.ts for the build output.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getApp } = require('../dist/serverless');

/**
 * Vercel serverless entry. All routes are rewritten to this function
 * (see vercel.json); req.url keeps the original path, which Fastify routes.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  app.getHttpAdapter().getInstance().server.emit('request', req, res);
}
