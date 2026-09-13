import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { createZip, ZipEntry } from '../../common/archive/zip.util';
import { centsToEuros } from '../../common/serialization/money.util';
import { fetchAllRows } from '../../common/serialization/pagination';
import { InvoicesService } from '../invoices/invoices.service';
import {
  ORDER_SELECT,
  OrderRow,
  toOrderDto,
} from '../orders/orders.serializer';
import { InvoiceExportQuery } from './dto/invoice-admin.dto';

interface InvoiceJoinRow {
  invoice_number: string;
  pdf_path: string;
  emailed_at: string | null;
}

/**
 * Billing identity of the customer. ORDER_SELECT's profile join carries only
 * what the order screens show (name, account type); an accountant also needs
 * the company and SIRET that make a B2B line deductible.
 */
interface BillingProfileRow {
  id: string;
  email: string | null;
  company: string | null;
  siret: string | null;
}

/** One line of the accounting export — one paid order and its facture. */
interface LedgerLine {
  invoiceNumber: string;
  orderNumber: string;
  date: string;
  client: string;
  clientEmail: string;
  company: string;
  siret: string;
  territory: string;
  subtotalHt: number;
  shipping: number;
  discount: number;
  vatRate: number;
  vat: number;
  totalTtc: number;
  refunded: number;
  vatNote: string;
  pdfPath: string;
}

/**
 * A single export cannot sit there rendering an unbounded number of PDFs —
 * each one costs a headless Chromium page. Anything past this and the admin is
 * told to narrow the period rather than watching the request time out.
 */
const MAX_BACKFILL_PER_EXPORT = 50;

const BUCKET = 'invoices';

/**
 * Accounting-facing view of the factures: one order's PDF on demand, and the
 * period export the comptable actually works from.
 *
 * Distinct from InvoicesService (which issues a facture as part of checkout):
 * nothing here ever emails a customer as a side effect of an admin looking at
 * their books. Emailing is its own explicit call.
 */
@Injectable()
export class AdminInvoicesService {
  private readonly logger = new Logger(AdminInvoicesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * Short-lived signed URL to one order's facture, generating it first if the
   * order predates the invoice system (or if checkout's own generation
   * failed). Never emails — an admin opening a facture must not fire a mail to
   * the customer.
   */
  async linkForOrder(idOrNumber: string): Promise<{ invoiceNumber: string; url: string }> {
    const order = toOrderDto(await this.loadPaidOrder(idOrNumber));
    await this.invoices.generateForOrder(order);
    const link = await this.invoices.getSignedUrl(order.id);
    if (!link) throw new NotFoundException('Facture indisponible pour le moment');
    return link;
  }

  /**
   * Sends (or re-sends) the facture to the order's customer. Used for orders
   * paid before the invoice system existed, and to retry a delivery that
   * failed at checkout.
   *
   * `force` clears `emailed_at` first: without it InvoicesService treats an
   * already-delivered facture as done and the call is a no-op, which is the
   * right default but useless when the customer says they never received it.
   */
  async emailForOrder(
    idOrNumber: string,
    force = false,
  ): Promise<{ sent: boolean; reason?: string }> {
    const order = toOrderDto(await this.loadPaidOrder(idOrNumber));
    await this.invoices.generateForOrder(order);
    if (force) {
      await this.supabase.client
        .from('invoices')
        .update({ emailed_at: null })
        .eq('order_id', order.id);
    }
    return this.invoices.deliverForOrder(order);
  }

  /**
   * The comptabilité export: every paid order in the period, as a CSV ledger
   * or as a ZIP of the PDF factures themselves.
   *
   * Both formats backfill missing factures first, so an accountant's export is
   * never short a document just because an order was paid before the invoice
   * system shipped. That backfill is capped (see MAX_BACKFILL_PER_EXPORT).
   */
  async export(
    query: InvoiceExportQuery,
  ): Promise<{ filename: string; contentType: string; body: Buffer }> {
    const { from, to } = resolvePeriod(query);
    const rows = await this.paidOrdersBetween(from, to);
    if (rows.length === 0) {
      throw new NotFoundException(
        'Aucune commande payée sur cette période — rien à exporter.',
      );
    }

    await this.backfill(rows);
    const [invoicesByOrder, billing] = await Promise.all([
      this.invoiceRows(rows.map((r) => r.id)),
      this.billingProfiles(rows),
    ]);
    const label = periodLabel(from, to);

    if (query.format === 'zip') {
      return {
        filename: `factures-${label}.zip`,
        contentType: 'application/zip',
        body: await this.buildZip(rows, invoicesByOrder, billing),
      };
    }

    const lines = rows.map((row) =>
      this.toLedgerLine(row, invoicesByOrder.get(row.id), billing.get(row.profile_id ?? '')),
    );
    return {
      filename: `factures-${label}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: Buffer.from(toCsv(lines), 'utf8'),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Accepts either the UUID or the `LMP-…` number the admin list works in. */
  private async loadPaidOrder(idOrNumber: string): Promise<OrderRow> {
    const column = idOrNumber.startsWith('LMP-') ? 'order_number' : 'id';
    const { data, error } = await this.supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq(column, idOrNumber)
      .maybeSingle<OrderRow>();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Commande introuvable');
    if (data.payment_status !== 'paid') {
      throw new BadRequestException(
        "Cette commande n'a pas été payée — aucune facture ne peut être émise.",
      );
    }
    return data;
  }

  /** Paid orders in [from, to), oldest first — the order a ledger is read in. */
  private async paidOrdersBetween(from: Date, to: Date): Promise<OrderRow[]> {
    return fetchAllRows<OrderRow>((start, end) =>
      this.supabase.client
        .from('orders')
        .select(ORDER_SELECT)
        .eq('payment_status', 'paid')
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(start, end)
        .returns<OrderRow[]>(),
    );
  }

  /** Generates the factures the period is missing, sequentially (each is a browser). */
  private async backfill(rows: OrderRow[]): Promise<void> {
    const { data } = await this.supabase.client
      .from('invoices')
      .select('order_id')
      .in('order_id', rows.map((r) => r.id))
      .returns<{ order_id: string }[]>();
    const have = new Set((data ?? []).map((r) => r.order_id));
    const missing = rows.filter((r) => !have.has(r.id));
    if (missing.length === 0) return;
    if (missing.length > MAX_BACKFILL_PER_EXPORT) {
      throw new BadRequestException(
        `${missing.length} factures restent à générer sur cette période. ` +
          `Exportez par périodes plus courtes (${MAX_BACKFILL_PER_EXPORT} maximum par export).`,
      );
    }
    for (const row of missing) {
      try {
        await this.invoices.generateForOrder(toOrderDto(row));
      } catch (err) {
        // One unrenderable order must not sink the whole export; it simply
        // lands in the CSV without an invoice number.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Backfill failed for order ${row.order_number}: ${message}`);
      }
    }
  }

  private async invoiceRows(orderIds: string[]): Promise<Map<string, InvoiceJoinRow>> {
    const { data } = await this.supabase.client
      .from('invoices')
      .select('order_id, invoice_number, pdf_path, emailed_at')
      .in('order_id', orderIds)
      .returns<(InvoiceJoinRow & { order_id: string })[]>();
    return new Map((data ?? []).map((r) => [r.order_id, r]));
  }

  /** Keyed by profile id; a deleted account leaves the order with no entry. */
  private async billingProfiles(rows: OrderRow[]): Promise<Map<string, BillingProfileRow>> {
    const ids = [...new Set(rows.map((r) => r.profile_id).filter((id): id is string => !!id))];
    if (ids.length === 0) return new Map();
    const { data } = await this.supabase.client
      .from('profiles')
      .select('id, email, company, siret')
      .in('id', ids)
      .returns<BillingProfileRow[]>();
    return new Map((data ?? []).map((p) => [p.id, p]));
  }

  private async buildZip(
    rows: OrderRow[],
    invoicesByOrder: Map<string, InvoiceJoinRow>,
    billing: Map<string, BillingProfileRow>,
  ): Promise<Buffer> {
    const entries: ZipEntry[] = [];
    for (const row of rows) {
      const invoice = invoicesByOrder.get(row.id);
      if (!invoice) continue;
      const { data, error } = await this.supabase
        .storageBucket(BUCKET)
        .download(invoice.pdf_path);
      if (error || !data) {
        this.logger.warn(
          `Facture ${invoice.invoice_number} unreadable, left out of the archive: ${error?.message ?? 'unknown'}`,
        );
        continue;
      }
      entries.push({
        name: `${invoice.invoice_number}.pdf`,
        content: Buffer.from(await data.arrayBuffer()),
        modified: new Date(row.created_at),
      });
    }
    if (entries.length === 0) {
      throw new NotFoundException('Aucune facture lisible sur cette période.');
    }
    // The ledger travels with the PDFs: the comptable gets the documents and
    // the table to reconcile them against in one download.
    entries.push({
      name: 'recapitulatif.csv',
      content: Buffer.from(
        toCsv(
          rows.map((r) =>
            this.toLedgerLine(r, invoicesByOrder.get(r.id), billing.get(r.profile_id ?? '')),
          ),
        ),
        'utf8',
      ),
    });
    return createZip(entries);
  }

  private toLedgerLine(
    row: OrderRow,
    invoice?: InvoiceJoinRow,
    profile?: BillingProfileRow,
  ): LedgerLine {
    const shipName = `${row.ship_first_name ?? ''} ${row.ship_last_name ?? ''}`.trim();
    return {
      invoiceNumber: invoice?.invoice_number ?? '',
      orderNumber: row.order_number,
      date: row.created_at.slice(0, 10),
      client: row.profile?.full_name?.trim() || shipName,
      clientEmail: profile?.email ?? '',
      company: profile?.company ?? '',
      siret: profile?.siret ?? '',
      territory: row.territory,
      subtotalHt: centsToEuros(row.subtotal_cents),
      shipping: centsToEuros(row.shipping_cost_cents),
      discount: centsToEuros(row.discount_cents ?? 0),
      vatRate: (row.vat_rate_bp ?? 0) / 100,
      vat: centsToEuros(row.vat_cents ?? 0),
      totalTtc: centsToEuros(row.total_cents),
      refunded: centsToEuros(row.refunded_total_cents ?? 0),
      vatNote: row.vat_exemption_note ?? '',
      pdfPath: invoice?.pdf_path ?? '',
    };
  }
}

const CSV_HEADER = [
  'numero_facture',
  'numero_commande',
  'date',
  'client',
  'email',
  'societe',
  'siret',
  'territoire',
  'total_ht',
  'livraison',
  'remise',
  'taux_tva',
  'tva',
  'total_ttc',
  'rembourse',
  'mention_tva',
  'fichier_pdf',
];

/**
 * Semicolon-separated with a UTF-8 BOM: French Excel splits on `;`, not `,`,
 * and without the BOM it renders accented client names as mojibake — both are
 * what makes the file openable by the person it is for.
 */
function toCsv(lines: LedgerLine[]): string {
  const cell = (v: string | number): string => {
    if (typeof v === 'number') return v.toFixed(2).replace('.', ',');
    return `"${v.replace(/"/g, '""')}"`;
  };
  const body = lines.map((l) =>
    [
      cell(l.invoiceNumber),
      cell(l.orderNumber),
      cell(l.date),
      cell(l.client),
      cell(l.clientEmail),
      cell(l.company),
      cell(l.siret),
      cell(l.territory),
      cell(l.subtotalHt),
      cell(l.shipping),
      cell(l.discount),
      cell(l.vatRate),
      cell(l.vat),
      cell(l.totalTtc),
      cell(l.refunded),
      cell(l.vatNote),
      cell(l.pdfPath),
    ].join(';'),
  );
  return `﻿${CSV_HEADER.join(';')}\n${body.join('\n')}\n`;
}

/**
 * `to` is inclusive of the whole day the admin picked — an accountant asking
 * for 01/01–31/01 means the 31st included, not up to its midnight.
 * Defaults to the current calendar year, the unit accounting works in.
 */
function resolvePeriod(query: InvoiceExportQuery): { from: Date; to: Date } {
  const now = new Date();
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('Dates invalides (format attendu : AAAA-MM-JJ)');
  }
  if (query.to) to.setUTCDate(to.getUTCDate() + 1);
  if (to <= from) {
    throw new BadRequestException('La date de fin doit suivre la date de début.');
  }
  return { from, to };
}

function periodLabel(from: Date, to: Date): string {
  const end = new Date(to.getTime() - 1);
  return `${from.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`;
}
