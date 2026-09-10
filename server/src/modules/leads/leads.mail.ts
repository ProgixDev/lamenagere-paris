import { CreateLeadDto } from './dto/create-lead.dto';

/**
 * The internal notification for a new lead.
 *
 * Written for the person who reads it on a phone between two appointments, not
 * for a marketing inbox: the name, the number and the message are above
 * everything else, and the `replyTo` set by the service means hitting Reply
 * answers the customer directly.
 *
 * Deliberately plain. This never leaves our own mailbox, so it does not need
 * the invoice email's table scaffolding — and a simple message is the one that
 * still renders correctly in whatever client actually opens it.
 */

const ETIQUETTES: Record<string, string> = {
  site: 'formulaire de contact',
  quiz: 'quiz /projet',
  showroom: 'showroom',
};

function esc(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface LeadMailContenu {
  subject: string;
  text: string;
  html: string;
}

export function renderLeadEmail(
  dto: CreateLeadDto,
  meta: { id: string; recuLe: Date },
): LeadMailContenu {
  const provenance = ETIQUETTES[dto.source ?? 'site'] ?? (dto.source ?? 'site');
  const recuLe = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(meta.recuLe);

  const lignes: [string, string | undefined][] = [
    ['Nom', dto.nom],
    ['E-mail', dto.email],
    ['Téléphone', dto.telephone],
    ['Code postal', dto.codePostal],
    ['Provenance', provenance],
    ['Reçu le', recuLe],
  ];

  const reponses = Object.entries(dto.reponses ?? {});

  const subject = `Nouvelle demande — ${dto.nom}${dto.codePostal ? ` (${dto.codePostal})` : ''}`;

  const text = [
    lignes
      .filter(([, v]) => v)
      .map(([cle, valeur]) => `${cle} : ${valeur}`)
      .join('\n'),
    '',
    'Message',
    '───────',
    dto.message,
    ...(reponses.length
      ? ['', 'Réponses au quiz', '────────────────',
         ...reponses.map(([cle, valeur]) => `${cle} : ${String(valeur)}`)]
      : []),
    '',
    `Référence : ${meta.id}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f5f5f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1c1c">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e6eb;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c6a664">Nouvelle demande</p>
    <h1 style="margin:0 0 24px;font-size:22px;line-height:1.2;color:#002444">${esc(dto.nom)}</h1>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      ${lignes
        .filter(([, v]) => v)
        .map(
          ([cle, valeur]) => `<tr>
        <td style="padding:7px 0;color:#3f454c;width:120px;vertical-align:top">${esc(cle)}</td>
        <td style="padding:7px 0;color:#1a1c1c">${esc(String(valeur))}</td>
      </tr>`,
        )
        .join('')}
    </table>
    <p style="margin:24px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c6a664">Message</p>
    <p style="margin:0;padding:16px;background:#f5f5f6;border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(dto.message)}</p>
    ${
      reponses.length
        ? `<p style="margin:24px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#c6a664">Réponses au quiz</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      ${reponses
        .map(
          ([cle, valeur]) => `<tr>
        <td style="padding:7px 0;color:#3f454c;width:120px;vertical-align:top">${esc(cle)}</td>
        <td style="padding:7px 0;color:#1a1c1c">${esc(String(valeur))}</td>
      </tr>`,
        )
        .join('')}
    </table>`
        : ''
    }
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e2e6eb;font-size:12px;color:#767c85">
      Répondre à ce message écrit directement à ${esc(dto.email)}.<br>Référence ${esc(meta.id)}
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
