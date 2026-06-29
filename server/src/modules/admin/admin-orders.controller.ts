import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { AdminOrdersService } from './admin-orders.service';
import {
  AcceptRefundDto,
  AddOrderNoteDto,
  OrderListQuery,
  RejectRefundDto,
  ShipOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order-admin.dto';

@Roles('admin', 'super_admin', 'manager')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list(@Query() query: OrderListQuery) {
    return this.orders.list(query);
  }

  @Get('export')
  async export(@Res() reply: FastifyReply) {
    const csv = await this.orders.exportCsv();
    void reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="orders.csv"')
      .send(csv);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(id, dto);
  }

  @Put(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.setStatus(id, dto);
  }

  @Post(':id/ship')
  @HttpCode(200)
  ship(@Param('id') id: string, @Body() dto: ShipOrderDto) {
    return this.orders.ship(id, dto);
  }

  // Admin-initiated direct refund (kept for backward compatibility) — same as accept.
  @Post(':id/refund')
  @HttpCode(200)
  refund(@Param('id') id: string) {
    return this.orders.acceptRefund(id);
  }

  @Post(':id/refund/accept')
  @HttpCode(200)
  acceptRefund(@Param('id') id: string, @Body() dto: AcceptRefundDto) {
    return this.orders.acceptRefund(id, dto.amountCents);
  }

  @Post(':id/refund/reject')
  @HttpCode(200)
  rejectRefund(@Param('id') id: string, @Body() dto: RejectRefundDto) {
    return this.orders.rejectRefund(id, dto.note);
  }

  @Post(':id/note')
  @HttpCode(201)
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddOrderNoteDto,
  ) {
    return this.orders.addNote(id, user.id, dto);
  }
}
