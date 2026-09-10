import nodemailer from 'nodemailer';

/**
 * The SMTP transport, shared.
 *
 * This is `modules/invoices/mailer.util.ts` lines 17-72 lifted out unchanged,
 * with the two hardcoded invoice attachments turned into a parameter and the
 * timeouts made overridable. The invoice module still owns its own templates
 * and re-exports `isSmtpConfigured` so nothing that imports it has to move.
 *
 * It was extracted because the contact form needs to send mail too, and a
 * second `nodemailer.createTransport` would be a second place to get the
 * serverless timeouts wrong.
 */

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Referenced from the HTML as `<img src="cid:…">`. */
  cid?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Hitting Reply answers this address rather than our own outbox. */
  replyTo?: string;
  attachments?: MailAttachment[];
  /**
   * Defaults are the invoice module's: generous, because a PDF send that fails
   * is worth waiting for. A form submission is not — see `leads.service.ts`,
   * which tightens all three so the whole request stays inside the 30s
   * `maxDuration` declared in `vercel.json`.
   */
  timeouts?: { connection: number; greeting: number; socket: number };
}

/** True once SMTP_HOST/SMTP_USER/SMTP_PASS are all set. */
export function isSmtpConfigured(): boolean {
  return (
    !!process.env.SMTP_HOST &&
    !!process.env.SMTP_USER &&
    !!process.env.SMTP_PASS
  );
}

/** Throws if SMTP isn't configured — callers should check `isSmtpConfigured()` first. */
export async function sendMail(input: MailInput): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)');
  }

  const delais = input.timeouts ?? {
    connection: 15_000,
    greeting: 15_000,
    socket: 30_000,
  };

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Serverless functions get frozen the moment the response is sent, so a
    // hung socket must fail fast rather than hold the send open.
    connectionTimeout: delais.connection,
    greetingTimeout: delais.greeting,
    socketTimeout: delais.socket,
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    // A text/plain part is not optional: without one the message scores as
    // spam far more easily, and it is what watches, screen readers and
    // plain-text clients actually render.
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}
