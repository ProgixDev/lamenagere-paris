import nodemailer from 'nodemailer';
import { LOGO_EMAIL_PNG_BASE64 } from './assets/logo-email-base64';

/** Referenced from the HTML as <img src="cid:…">; see `sendInvoiceEmail`. */
const LOGO_CID = 'lmp-logo';

export interface InvoiceEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
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
    // Serverless functions get frozen the moment the response is sent, so a
    // hung socket must fail fast rather than hold the invoice send open.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    // A text/plain part is not optional: without one the message scores as
    // spam far more easily, and it is what watches, screen readers and
    // plain-text clients actually render.
    text: input.text,
    html: input.html,
    attachments: [
      {
        filename: input.pdfFilename,
        content: input.pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        // Inline part rather than a data: URI — Gmail and Outlook both strip
        // data URIs in <img src>, cid: is the only thing that renders
        // everywhere without a remote fetch the recipient has to allow.
        filename: 'lamenagere-paris.png',
        content: Buffer.from(LOGO_EMAIL_PNG_BASE64, 'base64'),
        contentType: 'image/png',
        cid: LOGO_CID,
      },
    ],
  });
}

export interface InvoiceEmailBody {
  customerName?: string | null;
  orderNumber: string;
  invoiceNumber: string;
  pdfFilename: string;
  /** Formatted, e.g. "1 803,60 €". */
  total: string;
  /** Formatted, e.g. "3 septembre 2026". */
  paidDateLabel: string;
  /** The zone's lead time as free text, e.g. "2-3 semaines". */
  deliveryEstimate?: string | null;
  business: {
    name: string;
    email?: string | null;
    phone?: string | null;
    siret?: string | null;
    tvaIntracom?: string | null;
  };
}

// The brand, restated here rather than imported: an email is a separate medium
// with its own constraints (no CSS variables, no web fonts to speak of), and
// these five values are all it needs.
const INK = '#141A22';
const INK_MUTED = '#4B5563';
const INK_FAINT = '#8891A0';
const LINE = '#E3E7ED';
const PAPER_WASH = '#EEF1F4';
const PANEL = '#F4F6F9';
const NAVY = '#002444';
const BLUE = '#0049C9';
const YELLOW = '#FEC103';
const RED = '#F91317';
const PAID = '#0E8F5E';
const PAID_WASH = '#EAF6F0';

const SANS = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
// Cormorant only reaches Apple Mail, which is the only client worth loading a
// web font for. Everything else lands on Georgia and still reads as the same
// kind of serif, which is the point of the fallback order.
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',Times,serif";

/** One `Label ......... value` row of the summary panel. */
function summaryRow(label: string, value: string, opts?: { strong?: boolean }): string {
  return `
              <tr>
                <td style="padding:7px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${INK_MUTED};">${esc(label)}</td>
                <td align="right" style="padding:7px 0;font-family:${SANS};font-size:13px;line-height:20px;color:${INK};${opts?.strong ? 'font-weight:600;' : ''}">${esc(value)}</td>
              </tr>`;
}

/**
 * The facture email.
 *
 * Written to the rules of the medium, not of the web: nested tables, inline
 * styles on every element, no flexbox/grid, no background images, fixed 600px
 * body. The `<style>` block only carries progressive enhancement (the web
 * font and the mobile padding) — strip it entirely and the layout is
 * unchanged, which is exactly what happens in Gmail's mobile app for
 * non-Gmail accounts.
 *
 * Visually it is the PDF's twin: the tricolour rule, the three-dot mark, the
 * Cormorant headline, the navy total and the green "Payée" pill all come
 * straight from `invoice-template.ts`, so the mail and the document it
 * carries read as one object.
 */
export function renderInvoiceEmailHtml(body: InvoiceEmailBody): string {
  const greeting = body.customerName?.trim()
    ? `Bonjour ${esc(body.customerName.trim())},`
    : 'Bonjour,';

  const footerIdentity = [
    body.business.name,
    body.business.siret ? `SIRET ${body.business.siret}` : null,
    body.business.tvaIntracom ? `TVA ${body.business.tvaIntracom}` : null,
  ]
    .filter(Boolean)
    .map((v) => esc(v as string))
    .join(' &middot; ');

  const footerContact = [body.business.phone, body.business.email]
    .filter(Boolean)
    .map((v) => esc(v as string))
    .join(' &middot; ');

  const rows = [
    summaryRow('Facture', body.invoiceNumber),
    summaryRow('Commande', body.orderNumber),
    summaryRow('Réglée le', body.paidDateLabel),
    body.deliveryEstimate
      ? summaryRow('Livraison estimée', body.deliveryEstimate)
      : '',
  ].join('');

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!-- A facture is a document: it should look like paper in every client,
     never auto-inverted into a dark theme. -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Facture ${esc(body.invoiceNumber)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Progressive enhancement only — the layout does not depend on any of it. */
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
  a{color:${BLUE};}
  @media screen and (max-width:620px){
    .sp{padding-left:24px!important;padding-right:24px!important;}
    .headline{font-size:26px!important;line-height:32px!important;}
    .total{font-size:26px!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAPER_WASH};">
  <!-- Preheader: the one line most clients show next to the subject. The
       zero-width spaces stop the body copy from bleeding into it. -->
  <div style="display:none;font-size:1px;color:${PAPER_WASH};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Votre facture ${esc(body.invoiceNumber)} (${esc(body.total)}) est jointe à cet email au format PDF.
    &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER_WASH};">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">

          <!-- Tricolour rule, the same one that runs across the top of the PDF -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33.33%" height="5" bgcolor="${BLUE}" style="height:5px;line-height:5px;font-size:0;">&nbsp;</td>
                  <td width="33.33%" height="5" bgcolor="${YELLOW}" style="height:5px;line-height:5px;font-size:0;">&nbsp;</td>
                  <td width="33.34%" height="5" bgcolor="${RED}" style="height:5px;line-height:5px;font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Logo -->
          <tr>
            <td class="sp" align="left" style="padding:36px 40px 0;">
              <img src="cid:${LOGO_CID}" width="200" alt="${esc(body.business.name)}" style="display:block;width:200px;max-width:200px;height:auto;">
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td class="sp" style="padding:26px 40px 0;">
              <p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${INK_FAINT};">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${BLUE};"></span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${YELLOW};margin-left:3px;"></span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${RED};margin-left:3px;"></span>
                &nbsp; Facture acquittée
              </p>
              <h1 class="headline" style="margin:0 0 18px;font-family:${SERIF};font-size:32px;line-height:38px;font-weight:600;color:${INK};">
                Merci pour votre confiance.
              </h1>
              <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:24px;color:${INK_MUTED};">
                ${greeting}
              </p>
              <p style="margin:0;font-family:${SANS};font-size:15px;line-height:24px;color:${INK_MUTED};">
                Votre paiement a bien été reçu et votre commande est confirmée.
                Votre facture est jointe à cet email au format PDF — rien à
                demander, rien à télécharger ailleurs.
              </p>
            </td>
          </tr>

          <!-- Summary panel -->
          <tr>
            <td class="sp" style="padding:26px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL};border-radius:12px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
                      <tr>
                        <td colspan="2" style="padding:10px 0 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr><td height="1" bgcolor="${LINE}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 0 0;font-family:${SERIF};font-size:17px;font-weight:600;color:${INK};">Total payé TTC</td>
                        <td align="right" class="total" style="padding:14px 0 0;font-family:${SERIF};font-size:30px;font-weight:700;color:${NAVY};white-space:nowrap;">${esc(body.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Paid pill + attached file -->
          <tr>
            <td class="sp" style="padding:22px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${PAID_WASH};border-radius:100px;padding:7px 14px;font-family:${SANS};font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${PAID};white-space:nowrap;">
                    &#9679;&nbsp; Payée
                  </td>
                  <td style="padding-left:12px;font-family:${SANS};font-size:12.5px;line-height:18px;color:${INK_FAINT};">
                    Pièce jointe&nbsp;: <span style="color:${INK_MUTED};font-weight:600;">${esc(body.pdfFilename)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Where to find it again -->
          <tr>
            <td class="sp" style="padding:24px 40px 0;">
              <p style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK_MUTED};">
                Vous la retrouvez à tout moment dans l'application, rubrique
                <span style="color:${INK};font-weight:600;">Paiements &amp; factures</span>, avec le suivi de votre commande.
              </p>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td class="sp" style="padding:24px 40px 0;">
              <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:26px;font-style:italic;color:${INK_MUTED};">
                L'équipe ${esc(body.business.name)}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="sp" style="padding:30px 40px 34px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="1" bgcolor="${LINE}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
              </table>
              <p style="margin:16px 0 0;font-family:${SANS};font-size:11px;line-height:18px;color:${INK_FAINT};">
                ${footerIdentity}${footerContact ? `<br>${footerContact}` : ''}
              </p>
              <p style="margin:8px 0 0;font-family:${SANS};font-size:11px;line-height:18px;color:${INK_FAINT};">
                Cet email vous a été envoyé automatiquement à la suite de votre
                commande&nbsp;; il n'est pas nécessaire d'y répondre.
                Facture acquittée le ${esc(body.paidDateLabel)} — aucune somme restant due.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:18px 0 0;font-family:${SANS};font-size:11px;line-height:17px;color:${INK_FAINT};">
          ${esc(body.business.name)}
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The text/plain twin of the HTML above. Same information, same order — a
 * recipient who only ever sees this one is not missing anything.
 */
export function renderInvoiceEmailText(body: InvoiceEmailBody): string {
  const lines = [
    body.customerName?.trim() ? `Bonjour ${body.customerName.trim()},` : 'Bonjour,',
    '',
    'Votre paiement a bien été reçu et votre commande est confirmée.',
    'Votre facture est jointe à cet email au format PDF.',
    '',
    `Facture       ${body.invoiceNumber}`,
    `Commande      ${body.orderNumber}`,
    `Réglée le     ${body.paidDateLabel}`,
  ];
  if (body.deliveryEstimate) {
    lines.push(`Livraison     ${body.deliveryEstimate}`);
  }
  lines.push(
    `Total payé    ${body.total} TTC`,
    '',
    `Pièce jointe : ${body.pdfFilename}`,
    '',
    "Vous retrouvez cette facture à tout moment dans l'application,",
    'rubrique « Paiements & factures ».',
    '',
    `L'équipe ${body.business.name}`,
    '',
    '--',
    [
      body.business.name,
      body.business.siret ? `SIRET ${body.business.siret}` : null,
      body.business.tvaIntracom ? `TVA ${body.business.tvaIntracom}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    [body.business.phone, body.business.email].filter(Boolean).join(' · '),
    "Email automatique — il n'est pas nécessaire d'y répondre.",
  );
  return lines.filter((l) => l !== null).join('\n');
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
