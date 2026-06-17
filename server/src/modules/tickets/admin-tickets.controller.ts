import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { TicketsService } from './tickets.service';
import { TicketMessageDtoIn, UpdateTicketDto } from './dto/ticket.dto';

@Roles('admin', 'super_admin', 'manager', 'support')
@Controller('admin/tickets')
export class AdminTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('priority') priority?: string) {
    return this.tickets.adminList({ status, priority });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.tickets.adminDetail(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.tickets.adminUpdate(id, dto);
  }

  @Post(':id/messages')
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TicketMessageDtoIn,
  ) {
    return this.tickets.adminReply(id, user.id, dto);
  }
}
