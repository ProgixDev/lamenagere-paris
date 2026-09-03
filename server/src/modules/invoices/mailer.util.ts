import nodemailer from 'nodemailer';

export interface InvoiceEmailInput {
  to: string;
  subject: string;
  html: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
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
export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)');
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: [
      {
        filename: input.pdfFilename,
        content: input.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
