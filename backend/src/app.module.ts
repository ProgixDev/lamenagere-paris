import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { SupabaseModule } from './common/supabase/supabase.module';
import { StorageModule } from './common/storage/storage.module';
import { PricingModule } from './common/pricing/pricing.module';
import { AuthGuard } from './common/auth/auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AdminModule } from './modules/admin/admin.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SupabaseModule,
    StorageModule,
    PricingModule,
    AuthModule,
    CatalogModule,
    OrdersModule,
    QuotesModule,
    MessagingModule,
    NotificationsModule,
    PaymentsModule,
    TicketsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // AuthGuard runs first (authenticates), then RolesGuard (authorizes).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
