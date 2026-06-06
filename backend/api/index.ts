import type { IncomingMessage, ServerResponse } from 'http';
// Imports the COMPILED app (dist/) — Vercel runs `npm run build` first, so tsc
// has already emitted the decorator metadata Nest needs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { getApp } from '../dist/serverless';

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
