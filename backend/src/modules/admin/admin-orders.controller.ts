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
  AddOrderNoteDto,
  OrderListQuery,
  ShipOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order-admin.dto';

@Roles('admin', 'super_admin')
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

  @Post(':id/refund')
  @HttpCode(200)
  refund(@Param('id') id: string) {
    return this.orders.refund(id);
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
