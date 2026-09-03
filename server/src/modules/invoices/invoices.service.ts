import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { formatEUR } from '../../common/serialization/money.util';
import type { OrderDto } from '../orders/orders.serializer';
import { buildInvoiceData } from './invoice-data.util';
import { renderInvoiceHtml } from './invoice-template';
import { htmlToPdf } from './pdf.util';
import {
  isSmtpConfigured,
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
  sendInvoiceEmail,
} from './mailer.util';

interface SettingsRow {
  store_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  warehouse_address: string | null;
  siret: string | null;
  tva_intracom: string | null;
}

interface OrderExtrasRow {
  stripe_payment_intent_id: string | null;
  profile: {
    email: string | null;
    company: string | null;
    siret: string | null;
  } | null;
}

interface InvoiceRow {
  invoice_number: string;
  pdf_path: string;
  emailed_at: string | null;
}

/** A signed URL is short-lived on purpose — it's handed straight to the app and opened immediately. */
const SIGNED_URL_TTL_SECONDS = 300;

const BUCKET = 'invoices';

/** "3 septembre 2026" — the long form the facture itself uses. */
const PAID_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type DeliveryFailure =
  | 'no_invoice'
  | 'no_email'
  | 'smtp_not_configured'
  | 'pdf_unreadable'
  | 'send_failed';

export interface DeliveryResult {
  sent: boolean;
  /** Set when `sent` is false; also written to `invoices.email_error`. */
  reason?: DeliveryFailure;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Issues the facture for a just-paid order: renders the PDF, stores it, and
   * emails it to the customer. Called from `OrdersService.finalizeDraft()`
   * right after an order is created — the invoice is *sent*, never offered:
   * the customer is not asked whether they want it and does not have to do
   * anything to receive it.
   *
   * Never throws. A customer must not lose their paid order over a rendering
   * or SMTP failure, so generation failures are logged and delivery failures
   * are recorded in `invoices.email_error`. Both halves are idempotent, so
   * any later call (the webhook backstop, or the customer opening their
   * facture from order history) re-attempts whichever half did not succeed.
   */
  async issueForOrder(order: OrderDto): Promise<void> {
    try {
      await this.generateForOrder(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Invoice generation failed for order ${order.id}: ${message}`,
      );
      return;
    }
    await this.deliverForOrder(order);
  }

  /**
   * Renders and stores the PDF facture for a paid order.
   *
   * Idempotent: a second call for the same order (e.g. a customer opening
   * their facture before the checkout's own generation finished, or the
   * webhook backstop racing it) is a no-op once the `invoices` row exists.
   */
  async generateForOrder(order: OrderDto): Promise<void> {
    const { data: existing } = await this.supabase.client
      .from('invoices')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle<{ id: string }>();
    if (existing) return;

    const [{ data: settings }, { data: extras }] = await Promise.all([
      this.supabase.client
        .from('settings')
        .select('store_name, contact_email, contact_phone, warehouse_address, siret, tva_intracom')
        .eq('id', 1)
        .maybeSingle<SettingsRow>(),
      this.supabase.client
        .from('orders')
        .select('stripe_payment_intent_id, profile:profiles(email,company,siret)')
        .eq('id', order.id)
        .maybeSingle<OrderExtrasRow>(),
    ]);

    const year = new Date(order.createdAt).getFullYear();
    const { data: seq } = await this.supabase.client.rpc('next_counter', {
      p_scope: `invoice:${year}`,
    });
    const invoiceNumber = `FACT-${year}-${String(seq ?? 1).padStart(5, '0')}`;

    const data = buildInvoiceData({
      order,
      invoiceNumber,
      business: {
        name: settings?.store_name ?? 'La Ménagère Paris',
        addressLine: settings?.warehouse_address ?? '',
        phone: settings?.contact_phone,
        email: settings?.contact_email,
        website: 'lamenagereparis.com',
        siret: settings?.siret,
        tvaIntracom: settings?.tva_intracom,
      },
      customer: {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
        addressLines: [
          order.shippingAddress.street,
          `${order.shippingAddress.postalCode} ${order.shippingAddress.city}`,
          order.shippingAddress.country,
        ].filter(Boolean),
        phone: order.shippingAddress.phone,
        email: extras?.profile?.email,
        company: extras?.profile?.company,
        siret: extras?.profile?.siret,
      },
      paymentReference: extras?.stripe_payment_intent_id
        ? `…${extras.stripe_payment_intent_id.slice(-6)}`
        : undefined,
    });

    const html = renderInvoiceHtml(data);
    const pdf = await htmlToPdf(html);

    const path = `${order.id}/${invoiceNumber}.pdf`;
    const { error: uploadError } = await this.supabase
      .storageBucket(BUCKET)
      .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (uploadError) {
      throw new Error(`Invoice PDF upload failed: ${uploadError.message}`);
    }

    await this.supabase.client.from('invoices').insert({
      order_id: order.id,
      invoice_number: invoiceNumber,
      pdf_path: path,
    });
  }

  /**
   * A short-lived signed URL for the stored PDF, for the app to open directly
   * (`Linking.openURL`) — the bucket is private, so this is the only way a
   * client ever reaches the file. Returns `null` if no invoice exists yet for
   * this order (the caller should `generateForOrder` first).
   */
  async getSignedUrl(orderId: string): Promise<{ invoiceNumber: string; url: string } | null> {
    const { data: invoice } = await this.supabase.client
      .from('invoices')
      .select('invoice_number, pdf_path, emailed_at')
      .eq('order_id', orderId)
      .maybeSingle<InvoiceRow>();
    if (!invoice) return null;

    const { data, error } = await this.supabase
      .storageBucket(BUCKET)
      .createSignedUrl(invoice.pdf_path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      throw new Error(`Could not sign invoice URL: ${error?.message ?? 'unknown error'}`);
    }
    return { invoiceNumber: invoice.invoice_number, url: data.signedUrl };
  }

  /**
   * Emails the stored PDF to the order's customer. Re-uses the stored file
   * rather than re-rendering it, so what lands in the mailbox is byte-identical
   * to the archived facture.
   *
   * Never throws and never sends twice: once `emailed_at` is set the call is a
   * no-op, which is what makes it safe for `issueForOrder` to run on every
   * finalize attempt and on every later invoice read. Every failure — a missing
   * address, unconfigured SMTP, a rejected send — is recorded in
   * `invoices.email_error` so a silent non-delivery is visible in the database
   * instead of only in a log line.
   */
  async deliverForOrder(order: OrderDto): Promise<DeliveryResult> {
    const [{ data: invoice }, { data: extras }, { data: settings }] = await Promise.all([
      this.supabase.client
        .from('invoices')
        .select('invoice_number, pdf_path, emailed_at')
        .eq('order_id', order.id)
        .maybeSingle<InvoiceRow>(),
      this.supabase.client
        .from('orders')
        .select('profile:profiles(email,full_name)')
        .eq('id', order.id)
        .maybeSingle<{ profile: { email: string | null; full_name: string | null } | null }>(),
      this.supabase.client
        .from('settings')
        .select('store_name, contact_email, contact_phone, warehouse_address, siret, tva_intracom')
        .eq('id', 1)
        .maybeSingle<SettingsRow>(),
    ]);

    if (!invoice) return { sent: false, reason: 'no_invoice' };
    if (invoice.emailed_at) return { sent: true };

    const email = extras?.profile?.email;
    if (!email) return this.recordFailure(order.id, 'no_email', 'order has no customer email');
    if (!isSmtpConfigured()) {
      return this.recordFailure(
        order.id,
        'smtp_not_configured',
        'SMTP_HOST/SMTP_USER/SMTP_PASS are not all set in this environment',
      );
    }

    const { data: file, error: downloadError } = await this.supabase
      .storageBucket(BUCKET)
      .download(invoice.pdf_path);
    if (downloadError || !file) {
      return this.recordFailure(
        order.id,
        'pdf_unreadable',
        downloadError?.message ?? 'unknown storage error',
      );
    }
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    const pdfFilename = `${invoice.invoice_number}.pdf`;
    const body = {
      customerName: extras?.profile?.full_name,
      orderNumber: order.orderNumber,
      invoiceNumber: invoice.invoice_number,
      pdfFilename,
      total: formatEUR(order.total),
      paidDateLabel: PAID_DATE_FMT.format(new Date(order.createdAt)),
      deliveryEstimate: order.estimatedDelivery,
      business: {
        name: settings?.store_name ?? 'La Ménagère Paris',
        email: settings?.contact_email,
        phone: settings?.contact_phone,
        siret: settings?.siret,
        tvaIntracom: settings?.tva_intracom,
      },
    };

    try {
      await sendInvoiceEmail({
        to: email,
        subject: `Votre facture ${invoice.invoice_number} — ${body.business.name}`,
        html: renderInvoiceEmailHtml(body),
        text: renderInvoiceEmailText(body),
        pdfBuffer,
        pdfFilename,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.recordFailure(order.id, 'send_failed', message);
    }

    await this.supabase.client
      .from('invoices')
      .update({ emailed_at: new Date().toISOString(), email_error: null })
      .eq('order_id', order.id);
    this.logger.log(`Facture ${invoice.invoice_number} emailed to ${email}`);
    return { sent: true };
  }

  private async recordFailure(
    orderId: string,
    reason: DeliveryFailure,
    detail: string,
  ): Promise<DeliveryResult> {
    this.logger.warn(`Invoice email failed for order ${orderId} (${reason}): ${detail}`);
    await this.supabase.client
      .from('invoices')
      .update({ email_error: `${reason}: ${detail}`.slice(0, 300) })
      .eq('order_id', orderId);
    return { sent: false, reason };
  }
}
