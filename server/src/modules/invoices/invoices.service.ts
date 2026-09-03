import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import type { OrderDto } from '../orders/orders.serializer';
import { buildInvoiceData } from './invoice-data.util';
import { renderInvoiceHtml } from './invoice-template';
import { htmlToPdf } from './pdf.util';
import { isSmtpConfigured, sendInvoiceEmail } from './mailer.util';

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
}

/** A signed URL is short-lived on purpose — it's handed straight to the app and opened immediately. */
const SIGNED_URL_TTL_SECONDS = 300;

const BUCKET = 'invoices';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Generates the PDF facture for a just-paid order and stores it. Called
   * from `OrdersService.finalizeDraft()` right after an order is created —
   * never allowed to fail the checkout itself, so every step here is
   * defensive and every caller wraps this in try/catch too.
   *
   * Deliberately does NOT email anything: the customer chooses, on the
   * confirmation screen or later from "Paiements & factures", whether to
   * download it or have it emailed — see `emailExistingInvoice()`.
   *
   * Idempotent: a second call for the same order (e.g. a customer opening
   * "Télécharger la facture" before the checkout's own generation finished,
   * or the webhook backstop racing it) is a no-op once the `invoices` row
   * exists.
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
      .select('invoice_number, pdf_path')
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
   * Emails the already-generated PDF to the order's customer, on request
   * (the confirmation screen's "Recevoir par email" button, or the same
   * action from order history) — never automatic. Re-uses the stored PDF
   * rather than re-rendering it, so what's emailed is byte-identical to what
   * a download would give.
   */
  async emailExistingInvoice(
    orderId: string,
  ): Promise<{ sent: boolean; reason?: 'no_invoice' | 'no_email' | 'smtp_not_configured' | 'send_failed' }> {
    const [{ data: invoice }, { data: extras }] = await Promise.all([
      this.supabase.client
        .from('invoices')
        .select('invoice_number, pdf_path')
        .eq('order_id', orderId)
        .maybeSingle<InvoiceRow>(),
      this.supabase.client
        .from('orders')
        .select('order_number, profile:profiles(email)')
        .eq('id', orderId)
        .maybeSingle<{ order_number: string; profile: { email: string | null } | null }>(),
    ]);

    if (!invoice) return { sent: false, reason: 'no_invoice' };
    const email = extras?.profile?.email;
    if (!email) return { sent: false, reason: 'no_email' };
    if (!isSmtpConfigured()) return { sent: false, reason: 'smtp_not_configured' };

    const { data: file, error: downloadError } = await this.supabase
      .storageBucket(BUCKET)
      .download(invoice.pdf_path);
    if (downloadError || !file) {
      throw new Error(`Could not read stored invoice: ${downloadError?.message ?? 'unknown error'}`);
    }
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    try {
      await sendInvoiceEmail({
        to: email,
        subject: `Votre facture ${invoice.invoice_number} — La Ménagère Paris`,
        html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint votre facture pour la commande ${extras?.order_number ?? ''}.</p><p>L'équipe La Ménagère Paris</p>`,
        pdfBuffer,
        pdfFilename: `${invoice.invoice_number}.pdf`,
      });
      await this.supabase.client
        .from('invoices')
        .update({ emailed_at: new Date().toISOString(), email_error: null })
        .eq('order_id', orderId);
      return { sent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Invoice email failed for order ${orderId}: ${message}`);
      await this.supabase.client
        .from('invoices')
        .update({ email_error: message.slice(0, 300) })
        .eq('order_id', orderId);
      return { sent: false, reason: 'send_failed' };
    }
  }
}
