import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

// SupabaseService is provided by the @Global() SupabaseModule (see app.module).
// Deliberately self-contained (no dependency on OrdersModule/PaymentsModule)
// so OrdersModule can import this one-directionally with no risk of a cycle.
@Module({
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
