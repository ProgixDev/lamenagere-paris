/* eslint-disable no-console */
/**
 * Demo data seeder — populates realistic clients, orders, devis (quotes),
 * conversations + messages so the dashboard / analytics / lists are alive.
 *
 * Run:  npm run seed:demo
 *
 * Idempotent: demo customers use the @demo.lamenagere.fr domain; their orders,
 * quotes and conversations are wiped and regenerated on each run.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const DEMO_DOMAIN = '@demo.lamenagere.fr';
const rand = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

const ZONES = ['metropole', 'reunion', 'guadeloupe', 'martinique', 'guyane', 'mayotte'] as const;
const ORDER_STATUSES = [
  'commande_confirmee', 'en_preparation', 'en_attente_expedition', 'expediee', 'livree',
] as const;
const QUOTE_STATUSES = ['en_attente_devis', 'devis_envoye', 'devis_accepte', 'devis_rejete'] as const;
const STATUS_LABELS: Record<string, string> = {
  commande_confirmee: 'Commande confirmée', en_preparation: 'En préparation',
  en_attente_expedition: "En attente d'expédition", expediee: 'Expédiée', livree: 'Livrée',
};

interface DemoCustomer {
  firstName: string; lastName: string; accountType: 'particulier' | 'professionnel';
  company?: string; siret?: string; phone: string; territory: string;
  street: string; postal: string; city: string;
}

const CUSTOMERS: DemoCustomer[] = [
  { firstName: 'Sophie', lastName: 'Mercier', accountType: 'particulier', phone: '+33 6 12 34 56 78', territory: 'metropole', street: '12 rue de Rivoli', postal: '75001', city: 'Paris' },
  { firstName: 'Karim', lastName: 'Benali', accountType: 'professionnel', company: 'SARL Atelier Sud', siret: '821 234 567 00012', phone: '+33 6 22 33 44 55', territory: 'metropole', street: '8 avenue de la République', postal: '13001', city: 'Marseille' },
  { firstName: 'Léa', lastName: 'Moreau', accountType: 'particulier', phone: '+262 692 11 22 33', territory: 'reunion', street: '24 rue du Maréchal Leclerc', postal: '97400', city: 'Saint-Denis' },
  { firstName: 'Vincent', lastName: 'Roussel', accountType: 'particulier', phone: '+33 6 44 55 66 77', territory: 'metropole', street: '5 place Bellecour', postal: '69002', city: 'Lyon' },
  { firstName: 'Amina', lastName: 'Tazi', accountType: 'particulier', phone: '+262 639 44 55 66', territory: 'mayotte', street: '3 rue des Badamiers', postal: '97600', city: 'Mamoudzou' },
  { firstName: 'EURL', lastName: 'Décor Plus', accountType: 'professionnel', company: 'EURL Décor Plus', siret: '902 345 678 00021', phone: '+590 690 77 88 99', territory: 'guadeloupe', street: '17 boulevard du Front de Mer', postal: '97110', city: 'Pointe-à-Pitre' },
  { firstName: 'Camille', lastName: 'Leroux', accountType: 'particulier', phone: '+596 696 22 33 44', territory: 'martinique', street: '9 rue Victor Hugo', postal: '97200', city: 'Fort-de-France' },
  { firstName: 'Olivier', lastName: 'Dubois', accountType: 'particulier', phone: '+594 694 55 66 77', territory: 'guyane', street: '2 avenue du Général de Gaulle', postal: '97300', city: 'Cayenne' },
  { firstName: 'Maison', lastName: 'Moderne', accountType: 'professionnel', company: 'Maison Moderne SAS', siret: '513 456 789 00033', phone: '+33 1 45 67 89 10', territory: 'metropole', street: '40 rue du Faubourg Saint-Honoré', postal: '75008', city: 'Paris' },
];

interface ProductLite {
  id: string; name: string; price_mode: string; base_price_cents: number | null;
  product_type: string; image: string | null;
}

function daysAgoIso(maxDays: number): string {
  const d = new Date(Date.now() - randInt(0, maxDays) * 86400000);
  d.setHours(randInt(8, 20), randInt(0, 59), 0, 0);
  return d.toISOString();
}

async function ensureCustomer(sb: SupabaseClient, c: DemoCustomer): Promise<string> {
  const email = `${c.firstName}.${c.lastName}`.toLowerCase().replace(/[^a-z]+/g, '.') + DEMO_DOMAIN;
  const { data, error } = await sb.auth.admin.createUser({
    email, password: 'Demo2026!', email_confirm: true,
    user_metadata: { first_name: c.firstName, last_name: c.lastName, account_type: c.accountType, phone: c.phone, company: c.company, siret: c.siret },
  });
  let id = data?.user?.id;
  if (error && !id) {
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    id = (list?.users as Array<{ id: string; email?: string }> | undefined)?.find((u) => u.email === email)?.id;
  }
  if (!id) throw new Error(`customer ${email}: ${error?.message}`);

  await sb.from('profiles').update({
    first_name: c.firstName, last_name: c.lastName, phone: c.phone,
    account_type: c.accountType, company: c.company, siret: c.siret,
  }).eq('id', id);

  // One default address (replace existing).
  await sb.from('addresses').delete().eq('profile_id', id);
  await sb.from('addresses').insert({
    profile_id: id, first_name: c.firstName, last_name: c.lastName, street: c.street,
    postal_code: c.postal, city: c.city, country: 'France', territory: c.territory, is_default: true,
  });
  return id;
}

async function nextNumber(sb: SupabaseClient, scope: string): Promise<number> {
  const { data } = await sb.rpc('next_counter', { p_scope: scope });
  return (data as number) ?? 1;
}

async function main() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required');
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log('Seeding demo data…');

  // Products to sell (purchasable = has a base price) + quote-only for devis.
  const { data: prods } = await sb
    .from('products')
    .select('id, name, price_mode, base_price_cents, product_type, media:product_media(url, type, is_primary)')
    .returns<(ProductLite & { media: { url: string; type: string; is_primary: boolean }[] })[]>();
  const products: ProductLite[] = (prods ?? []).map((p) => ({
    id: p.id, name: p.name, price_mode: p.price_mode, base_price_cents: p.base_price_cents,
    product_type: p.product_type,
    image: p.media?.find((m) => m.is_primary && m.type === 'image')?.url ?? p.media?.find((m) => m.type === 'image')?.url ?? null,
  }));
  const sellable = products.filter((p) => p.base_price_cents != null);
  const quotable = products.filter((p) => p.product_type !== 'standard');
  if (sellable.length === 0) throw new Error('No priced products — run `npm run seed` first.');

  // Customers.
  const customers: { id: string; c: DemoCustomer }[] = [];
  for (const c of CUSTOMERS) customers.push({ id: await ensureCustomer(sb, c), c });
  console.log(`• customers: ${customers.length}`);

  // Wipe previous demo orders/quotes/conversations.
  const ids = customers.map((x) => x.id);
  await sb.from('orders').delete().in('profile_id', ids);
  await sb.from('quotes').delete().in('profile_id', ids);
  await sb.from('conversations').delete().in('profile_id', ids);

  const { data: zoneFees } = await sb.from('shipping_zone_fees').select('zone, delay, fee_cents');
  const feeOf = (z: string) => (zoneFees ?? []).find((f) => f.zone === z) ?? { fee_cents: 0, delay: '2-3 semaines' };

  // ── Orders (last 90 days) ─────────────────────────────────────────────────
  const spent = new Map<string, { total: number; count: number; last: string }>();
  let orderN = 0;
  for (let i = 0; i < 46; i++) {
    const { id: profileId, c } = rand(customers);
    const createdAt = daysAgoIso(90);
    const lineCount = randInt(1, 3);
    const items: { product: ProductLite; qty: number }[] = [];
    let subtotal = 0;
    for (let j = 0; j < lineCount; j++) {
      const p = rand(sellable);
      const qty = randInt(1, 2);
      items.push({ product: p, qty });
      subtotal += (p.base_price_cents ?? 0) * qty;
    }
    const fee = feeOf(c.territory);
    const total = subtotal + fee.fee_cents;
    // Older orders skew toward delivered.
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    const status =
      ageDays > 45 ? rand(['livree', 'livree', 'expediee'] as const)
      : ageDays > 20 ? rand(['expediee', 'en_attente_expedition', 'livree'] as const)
      : rand(ORDER_STATUSES);
    const year = new Date(createdAt).getFullYear();
    const num = await nextNumber(sb, `order:${year}`);
    const orderNumber = `LMP-${year}-${String(num).padStart(5, '0')}`;

    const { data: order } = await sb.from('orders').insert({
      order_number: orderNumber, profile_id: profileId, status,
      subtotal_cents: subtotal, shipping_cost_cents: fee.fee_cents, total_cents: total,
      territory: c.territory, shipping_method: 'Standard', estimated_delivery: fee.delay,
      ship_first_name: c.firstName, ship_last_name: c.lastName, ship_street: c.street,
      ship_postal_code: c.postal, ship_city: c.city, ship_country: 'France', ship_territory: c.territory,
      is_b2b: c.accountType === 'professionnel', created_at: createdAt,
    }).select('id').single<{ id: string }>();
    if (!order) continue;

    await sb.from('order_items').insert(items.map((it) => ({
      order_id: order.id, product_id: it.product.id, product_name: it.product.name,
      product_image: it.product.image, quantity: it.qty, unit_price_cents: it.product.base_price_cents,
    })));
    // Timeline up to current status.
    const flowIdx = ORDER_STATUSES.indexOf(status);
    await sb.from('order_timeline').insert(
      ORDER_STATUSES.slice(0, flowIdx + 1).map((s) => ({
        order_id: order.id, status: s, label: STATUS_LABELS[s], completed: true, occurred_at: createdAt,
      })),
    );

    const agg = spent.get(profileId) ?? { total: 0, count: 0, last: createdAt };
    agg.total += total; agg.count += 1;
    if (createdAt > agg.last) agg.last = createdAt;
    spent.set(profileId, agg);
    orderN++;
  }
  // Profile aggregates.
  for (const [pid, a] of spent) {
    await sb.from('profiles').update({ orders_count: a.count, total_spent_cents: a.total, last_activity_at: a.last }).eq('id', pid);
  }
  console.log(`• orders: ${orderN}`);

  // ── Quotes (devis) ────────────────────────────────────────────────────────
  let quoteN = 0;
  for (let i = 0; i < 14; i++) {
    const { id: profileId, c } = rand(customers);
    const p = rand(quotable.length ? quotable : sellable);
    const createdAt = daysAgoIso(60);
    const status = rand(QUOTE_STATUSES);
    const year = new Date(createdAt).getFullYear();
    const num = await nextNumber(sb, `quote:${year}`);
    const decided = status === 'devis_accepte' || status === 'devis_rejete';
    const sent = status !== 'en_attente_devis';
    const quotedCents = sent ? randInt(40, 220) * 100 * randInt(8, 30) : null;

    const { data: q } = await sb.from('quotes').insert({
      quote_number: `DEV-${year}-${String(num).padStart(5, '0')}`, profile_id: profileId,
      product_id: p.id, product_name: p.name, product_image: p.image,
      req_width: randInt(80, 400), req_height: randInt(180, 280),
      notes: rand(['Installation en angle souhaitée.', 'Finition mate si possible.', 'Livraison étage sans ascenseur.', '']),
      status, quoted_price_cents: quotedCents,
      fabrication_delay: sent ? '6-8 semaines' : null, validity_days: 60,
      is_b2b: c.accountType === 'professionnel',
      sent_at: sent ? createdAt : null, decided_at: decided ? createdAt : null, created_at: createdAt,
    }).select('id').single<{ id: string }>();
    if (q && quotedCents) {
      await sb.from('quote_items').insert([
        { quote_id: q.id, description: p.name + ' sur mesure', quantity: 1, unit_price_cents: Math.round(quotedCents * 0.85), sort_order: 0 },
        { quote_id: q.id, description: 'Installation & livraison', quantity: 1, unit_price_cents: Math.round(quotedCents * 0.15), sort_order: 1 },
      ]);
    }
    quoteN++;
  }
  console.log(`• quotes: ${quoteN}`);

  // ── Conversations + messages ──────────────────────────────────────────────
  let convN = 0;
  const SUBJECTS = ['Question sur les délais', 'Devis personnalisé', 'Suivi de commande', 'Disponibilité coloris', 'Conseil produit'];
  for (let i = 0; i < 6; i++) {
    const { id: profileId, c } = customers[i % customers.length];
    const p = rand(products);
    const createdAt = daysAgoIso(20);
    const lastMsg = rand(['Bonjour, pouvez-vous me renseigner ?', 'Merci pour votre réponse rapide !', 'Quel est le délai pour ma région ?', 'Je confirme la commande.']);
    const unread = randInt(0, 2);
    const { data: conv } = await sb.from('conversations').insert({
      profile_id: profileId, subject: rand(SUBJECTS), product_id: p.id,
      vendor_name: 'Service Client', last_message: lastMsg, last_message_at: createdAt,
      unread_admin: unread, unread_customer: 0, is_b2b: c.accountType === 'professionnel', created_at: createdAt,
    }).select('id').single<{ id: string }>();
    if (!conv) continue;
    const thread = [
      { sender: 'customer', content: `Bonjour, je suis intéressé(e) par ${p.name}. Quelques questions...` },
      { sender: 'admin', content: 'Bonjour ! Avec plaisir, que souhaitez-vous savoir ?' },
      { sender: 'customer', content: lastMsg },
    ];
    for (let m = 0; m < thread.length; m++) {
      const ts = new Date(new Date(createdAt).getTime() + m * 3600000).toISOString();
      await sb.from('messages').insert({
        conversation_id: conv.id, sender: thread[m].sender, sender_id: thread[m].sender === 'customer' ? profileId : null,
        content: thread[m].content, created_at: ts,
      });
    }
    convN++;
  }
  console.log(`• conversations: ${convN}`);

  await seedTickets(sb, customers);

  console.log('✓ demo seed complete');
}

async function seedTickets(
  sb: SupabaseClient,
  customers: { id: string; c: DemoCustomer }[],
): Promise<void> {
  // Skip gracefully if the tickets migration hasn't been applied yet.
  const probe = await sb.from('tickets').select('id').limit(1);
  if (probe.error) {
    console.log('• tickets: skipped (apply migration 0007_tickets first)');
    return;
  }

  const ids = customers.map((x) => x.id);
  await sb.from('tickets').delete().in('profile_id', ids);

  const CATS = ['commande', 'livraison', 'produit', 'paiement', 'autre'] as const;
  const PRIOS = ['basse', 'normale', 'haute', 'urgente'] as const;
  const TSTATUS = ['ouvert', 'en_cours', 'resolu', 'ferme'] as const;
  const SUBJECTS: Record<string, string[]> = {
    commande: ['Erreur dans ma commande', 'Article manquant', 'Annulation de commande'],
    livraison: ['Colis endommagé', 'Retard de livraison', 'Livraison non reçue'],
    produit: ['Produit défectueux', 'Dimensions non conformes', "Pièce manquante au montage"],
    paiement: ['Double prélèvement', 'Remboursement en attente', 'Problème de facturation'],
    autre: ['Question sur la garantie', 'Demande de SAV'],
  };

  let n = 0;
  for (let i = 0; i < 9; i++) {
    const { id: profileId } = rand(customers);
    const cat = rand(CATS);
    const status = rand(TSTATUS);
    const createdAt = daysAgoIso(45);
    const year = new Date(createdAt).getFullYear();
    const num = await nextNumber(sb, `ticket:${year}`);
    const { data: ticket } = await sb
      .from('tickets')
      .insert({
        ticket_number: `TKT-${year}-${String(num).padStart(5, '0')}`,
        profile_id: profileId,
        subject: rand(SUBJECTS[cat]),
        category: cat,
        description: rand([
          "Bonjour, je rencontre un souci et j'aimerais votre aide rapidement.",
          'Le problème persiste malgré plusieurs tentatives, merci de me recontacter.',
          'Pouvez-vous me confirmer la marche à suivre ? Merci d\'avance.',
        ]),
        status,
        priority: rand(PRIOS),
        unread_admin: status === 'ouvert' ? 1 : 0,
        created_at: createdAt,
        resolved_at: status === 'resolu' || status === 'ferme' ? createdAt : null,
      })
      .select('id')
      .single<{ id: string }>();
    if (!ticket) continue;
    // A reply on tickets that are being handled.
    if (status !== 'ouvert') {
      await sb.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender: 'admin',
        content: 'Bonjour, merci pour votre message. Nous traitons votre demande et revenons vers vous très vite.',
        created_at: new Date(new Date(createdAt).getTime() + 3600000).toISOString(),
      });
    }
    n++;
  }
  console.log(`• tickets: ${n}`);
}

main().catch((e) => { console.error('✗ demo seed failed:', e); process.exit(1); });
