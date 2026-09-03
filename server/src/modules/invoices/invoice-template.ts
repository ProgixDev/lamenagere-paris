import { LOGO_PNG_BASE64 } from './assets/logo-base64';

export interface InvoiceLineSpec {
  label: string;
  value: string;
}

export interface InvoiceLine {
  name: string;
  quantity: number;
  unitPriceLabel: string;
  totalLabel: string;
  specs: InvoiceLineSpec[];
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  issuedDateLabel: string;
  paidDateLabel: string;
  paidDateShortLabel: string;
  business: {
    name: string;
    addressLine: string;
    phone?: string;
    email?: string;
    website?: string;
    siret?: string;
    tvaIntracom?: string;
  };
  customer: {
    name: string;
    addressLines: string[];
    phone?: string;
    email?: string;
    company?: string;
    siret?: string;
  };
  payment: {
    method: string;
    reference?: string;
    deliveryEstimate: string;
    territoryLabel: string;
  };
  lines: InvoiceLine[];
  totals: {
    subtotalLabel: string;
    discountLabel?: string;
    shippingLabel: string;
    vat?: { rateLabel: string; amountLabel: string };
    exemptionNote?: string;
    totalLabel: string;
  };
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
  :root{
    --paper:#FFFFFF;
    --chip:#F4F6F9;
    --ink:#141A22;
    --ink-muted:#4B5563;
    --ink-faint:#8891A0;
    --line:#E3E7ED;
    --navy:#002444;
    --blue:#0049C9;
    --yellow:#FEC103;
    --red:#F91317;
    --paid:#0E8F5E;
    --paid-wash:#EAF6F0;
  }
  *{box-sizing:border-box;}
  html,body{background:var(--paper);}
  body{
    margin:0;
    color:var(--ink);
    font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .page{
    width:210mm;
    min-height:297mm;
    background:var(--paper);
    padding:20mm 16mm 14mm;
    position:relative;
    overflow:hidden;
  }
  .ribbon{position:absolute;left:0;right:0;height:5px;display:flex;}
  .ribbon.top{top:0;}
  .ribbon.bottom{bottom:0;}
  .ribbon span{flex:1;}
  .ribbon .b1{background:var(--blue);}
  .ribbon .b2{background:var(--yellow);}
  .ribbon .b3{background:var(--red);}
  .watermark{position:absolute;z-index:-1;right:-70px;bottom:40px;width:360px;height:360px;opacity:.05;pointer-events:none;}
  .dots{display:inline-flex;gap:3px;vertical-align:middle;}
  .dots span{width:6px;height:6px;border-radius:50%;display:inline-block;}
  .dots .d1{background:var(--blue);}
  .dots .d2{background:var(--yellow);}
  .dots .d3{background:var(--red);}

  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:1px solid var(--line);}
  .brand{display:flex;gap:16px;align-items:flex-start;}
  .brand .logo{height:38px;width:auto;flex:none;margin-top:3px;}
  .brand-meta{font-size:12px;line-height:1.65;color:var(--ink-muted);padding-top:2px;}
  .brand-meta .siret{color:var(--ink-faint);}
  .doc{text-align:right;}
  .doc-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 4px;}
  .doc-title{font-family:"Cormorant Garamond",serif;font-weight:600;font-size:26px;color:var(--ink);margin:0 0 10px;line-height:1;white-space:nowrap;}
  .doc-meta{font-size:12.5px;line-height:1.9;color:var(--ink-muted);}
  .doc-meta b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums;}
  .status{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 12px;border-radius:100px;background:var(--paid-wash);color:var(--paid);font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
  .status::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--paid);}

  .parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:22px 0;border-bottom:1px solid var(--line);}
  .party-label{font-size:10.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 8px;}
  .party-name{font-size:15px;font-weight:600;color:var(--ink);margin:0 0 4px;}
  .party-detail{font-size:12.5px;line-height:1.7;color:var(--ink-muted);}
  .pay-row{display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0;color:var(--ink-muted);}
  .pay-row span:last-child{color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums;}

  table{width:100%;border-collapse:collapse;margin-top:22px;}
  thead th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint);padding:0 0 9px;border-bottom:1.5px solid var(--ink);}
  thead th.num{text-align:right;}
  tbody td{padding:14px 0;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px;}
  tbody td.num{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap;}
  .item-name{font-weight:600;color:var(--ink);margin:0 0 6px;}
  .specs{display:flex;flex-wrap:wrap;gap:5px;max-width:340px;}
  .spec{font-size:10.5px;color:var(--ink-muted);background:var(--chip);border:1px solid var(--line);border-radius:5px;padding:2.5px 7px;white-space:nowrap;}
  .spec b{color:var(--ink);font-weight:600;}

  .foot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:26px;}
  .seal{flex:none;width:118px;height:118px;border:2px solid var(--paid);border-radius:50%;display:flex;align-items:center;justify-content:center;transform:rotate(-13deg);opacity:.85;margin-bottom:6px;position:relative;}
  .seal::before{content:"";position:absolute;inset:6px;border:1px solid var(--paid);border-radius:50%;opacity:.6;}
  .seal-inner{text-align:center;color:var(--paid);font-family:"Cormorant Garamond",serif;}
  .seal-inner .a{font-size:16px;font-weight:700;letter-spacing:.08em;display:block;}
  .seal-inner .b{font-size:10px;letter-spacing:.05em;color:var(--paid);opacity:.85;display:block;margin-top:2px;font-family:"Inter",sans-serif;font-weight:600;}
  .totals{width:280px;flex:none;}
  .trow{display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;color:var(--ink-muted);}
  .trow span:last-child{font-variant-numeric:tabular-nums;color:var(--ink);}
  .trow.discount span:last-child{color:var(--paid);}
  .trow.grand{margin-top:8px;padding-top:12px;border-top:1.5px solid var(--ink);}
  .trow.grand span:first-child{font-family:"Cormorant Garamond",serif;font-size:16px;font-weight:600;color:var(--ink);}
  .trow.grand span:last-child{font-family:"Cormorant Garamond",serif;font-size:24px;font-weight:700;color:var(--navy);}

  .legal{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:24px;font-size:10.5px;line-height:1.7;color:var(--ink-faint);}
  .legal p{margin:0;}
  .legal .thanks{font-family:"Cormorant Garamond",serif;font-size:14px;font-style:italic;color:var(--ink-muted);max-width:280px;}
`;

function renderSpecs(specs: InvoiceLineSpec[]): string {
  return specs
    .map((s) =>
      s.label
        ? `<span class="spec">${esc(s.label)} : <b>${esc(s.value)}</b></span>`
        : `<span class="spec"><b>${esc(s.value)}</b></span>`,
    )
    .join('');
}

function renderLine(line: InvoiceLine): string {
  return `
    <tr>
      <td>
        <p class="item-name">${esc(line.name)}</p>
        <div class="specs">${renderSpecs(line.specs)}</div>
      </td>
      <td class="num">${line.quantity}</td>
      <td class="num">${esc(line.unitPriceLabel)}</td>
      <td class="num">${esc(line.totalLabel)}</td>
    </tr>`;
}

/**
 * Renders the full invoice as a standalone HTML document (fonts loaded from
 * Google Fonts, logo embedded as a data URI) — ready to feed straight into
 * `htmlToPdf()`. No preview chrome: this is the document itself, not the
 * browser-review wrapper the design draft used.
 */
export function renderInvoiceHtml(data: InvoiceData): string {
  const totalsRows: string[] = [
    `<div class="trow"><span>Sous-total HT</span><span>${esc(data.totals.subtotalLabel)}</span></div>`,
  ];
  if (data.totals.discountLabel) {
    totalsRows.push(
      `<div class="trow discount"><span>Réduction</span><span>${esc(data.totals.discountLabel)}</span></div>`,
    );
  }
  totalsRows.push(
    `<div class="trow"><span>Livraison</span><span>${esc(data.totals.shippingLabel)}</span></div>`,
  );
  if (data.totals.vat) {
    totalsRows.push(
      `<div class="trow"><span>TVA (${esc(data.totals.vat.rateLabel)})</span><span>${esc(data.totals.vat.amountLabel)}</span></div>`,
    );
  }
  totalsRows.push(
    `<div class="trow grand"><span>Total TTC</span><span>${esc(data.totals.totalLabel)}</span></div>`,
  );

  const customerLines = data.customer.addressLines
    .map((l) => esc(l))
    .join('<br>\n        ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(data.invoiceNumber)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="ribbon top"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
    <div class="ribbon bottom"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
    <svg class="watermark" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="70" cy="70" r="58" fill="#0049C9"/>
      <circle cx="130" cy="70" r="58" fill="#FEC103"/>
      <circle cx="100" cy="128" r="58" fill="#F91317"/>
    </svg>

    <div class="head">
      <div class="brand">
        <img class="logo" src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="${esc(data.business.name)}">
        <div>
          <div class="brand-meta">
            ${esc(data.business.addressLine)}<br>
            ${[data.business.phone, data.business.email].filter(Boolean).map(esc).join(' &middot; ')}<br>
            ${[data.business.website, data.business.siret ? `SIRET ${data.business.siret}` : null]
              .filter(Boolean)
              .map((v, i) => (i === 1 ? `<span class="siret">${esc(v as string)}</span>` : esc(v as string)))
              .join(' &middot; ')}
          </div>
        </div>
      </div>
      <div class="doc">
        <p class="doc-eyebrow"><span class="dots"><span class="d1"></span><span class="d2"></span><span class="d3"></span></span>&nbsp; Facture</p>
        <p class="doc-title">${esc(data.invoiceNumber)}</p>
        <div class="doc-meta">
          Commande&nbsp;&nbsp;<b>${esc(data.orderNumber)}</b><br>
          Émise le&nbsp;&nbsp;<b>${esc(data.issuedDateLabel)}</b><br>
          Réglée le&nbsp;&nbsp;<b>${esc(data.paidDateLabel)}</b>
        </div>
        <span class="status">Payée</span>
      </div>
    </div>

    <div class="parties">
      <div>
        <p class="party-label">Facturé à</p>
        <p class="party-name">${esc(data.customer.name)}${data.customer.company ? ` &middot; ${esc(data.customer.company)}` : ''}</p>
        <div class="party-detail">
          ${customerLines}
          ${data.customer.phone ? `<br>${esc(data.customer.phone)}` : ''}
          ${data.customer.email ? `<br>${esc(data.customer.email)}` : ''}
          ${data.customer.siret ? `<br>SIRET ${esc(data.customer.siret)}` : ''}
        </div>
      </div>
      <div>
        <p class="party-label">Règlement</p>
        <div class="pay-row"><span>Moyen de paiement</span><span>${esc(data.payment.method)}</span></div>
        ${data.payment.reference ? `<div class="pay-row"><span>Référence</span><span>${esc(data.payment.reference)}</span></div>` : ''}
        <div class="pay-row"><span>Livraison estimée</span><span>${esc(data.payment.deliveryEstimate)}</span></div>
        <div class="pay-row"><span>Zone de livraison</span><span>${esc(data.payment.territoryLabel)}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:52%;">Article</th>
          <th class="num" style="width:10%;">Qté</th>
          <th class="num" style="width:19%;">Prix unit. HT</th>
          <th class="num" style="width:19%;">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${data.lines.map(renderLine).join('\n')}
      </tbody>
    </table>

    <div class="foot">
      <div class="seal">
        <div class="seal-inner">
          <span class="a">PAYÉE</span>
          <span class="b">${esc(data.paidDateShortLabel)}</span>
        </div>
      </div>
      <div class="totals">
        ${totalsRows.join('\n        ')}
      </div>
    </div>

    <div class="legal">
      <p class="thanks">Merci pour votre confiance.<br>L'équipe ${esc(data.business.name)}.</p>
      <p style="text-align:right;max-width:340px;">
        ${esc(data.business.name)}${data.business.siret ? ` &middot; SIRET ${esc(data.business.siret)}` : ''}${data.business.tvaIntracom ? ` &middot; TVA ${esc(data.business.tvaIntracom)}` : ''}<br>
        Facture acquittée le ${esc(data.paidDateLabel)} — aucune somme restant due.<br>
        ${data.totals.exemptionNote ? esc(data.totals.exemptionNote) : 'TVA facturée au taux normal en vigueur en France métropolitaine.'}
      </p>
    </div>
  </div>
</body>
</html>`;
}
