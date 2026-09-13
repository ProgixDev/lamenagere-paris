/* eslint-disable no-console */
/**
 * Issues (generates + emails) the PDF facture for one already-paid order.
 *
 * For orders that were paid *before* the invoice system shipped (0041): they
 * have no `invoices` row, so nothing was ever generated or sent. Everything
 * here goes through the ordinary InvoicesService path, so the resulting PDF
 * and email are identical to what a fresh checkout produces.
 *
 * Run:  npx ts-node -r tsconfig-paths/register scripts/issue-invoice.ts LMP-2026-00005
 *       ... --no-email    generate and store the PDF without mailing it
 *
 * Idempotent on both halves (see InvoicesService): re-running never produces a
 * second invoice number and never sends a second email.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/common/supabase/supabase.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import {
  ORDER_SELECT,
  OrderRow,
  toOrderDto,
} from '../src/modules/orders/orders.serializer';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const orderNumber = args.find((a) => !a.startsWith('--'));
  const email = !args.includes('--no-email');
  if (!orderNumber) {
    console.error('Usage: issue-invoice.ts <ORDER_NUMBER> [--no-email]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const supabase = app.get(SupabaseService);
    const invoices = app.get(InvoicesService);

    const { data: row, error } = await supabase.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('order_number', orderNumber)
      .maybeSingle<OrderRow>();
    if (error) throw new Error(error.message);
    if (!row) throw new Error(`No order ${orderNumber}`);
    if (row.payment_status !== 'paid') {
      throw new Error(
        `Order ${orderNumber} is ${row.payment_status}, not paid — refusing to invoice it`,
      );
    }

    const order = toOrderDto(row);
    await invoices.generateForOrder(order);
    const link = await invoices.getSignedUrl(order.id);
    console.log(`Facture ${link?.invoiceNumber} stored for ${orderNumber}`);

    if (email) {
      const result = await invoices.deliverForOrder(order);
      console.log(
        result.sent ? 'Emailed to the customer.' : `NOT emailed: ${result.reason}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
