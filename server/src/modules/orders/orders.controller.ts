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
import { CreateOrderDto } from './dto/create-order.dto';
import { RequestRefundDto } from './dto/request-refund.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto, user.accountType === 'professionnel');
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.findOne(user.id, id);
  }

  @Get(':id/tracking')
  tracking(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.tracking(user.id, id);
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
