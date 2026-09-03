import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { OrdersService } from './orders.service';
import { RequestRefundDto } from './dto/request-refund.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.list(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.findOne(user.id, id);
  }

  @Get(':id/tracking')
  tracking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.tracking(user.id, id);
  }

  /**
   * The facture is emailed automatically the moment payment succeeds, so this
   * only exists to let the customer re-open the PDF they already received.
   */
  @Get(':id/invoice')
  getInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getInvoiceLink(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.cancel(user.id, id);
  }

  @Post(':id/request-refund')
  @HttpCode(200)
  requestRefund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RequestRefundDto,
  ) {
    return this.orders.requestRefund(user.id, id, dto.reason);
  }
}
