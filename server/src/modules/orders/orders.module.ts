import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TicketsModule } from '../tickets/tickets.module';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [TicketsModule, PromoModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
