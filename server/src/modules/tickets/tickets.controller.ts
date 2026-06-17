import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, TicketMessageDtoIn } from './dto/ticket.dto';

/** Customer-facing support tickets ("Signaler un problème"). */
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tickets.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tickets.getForUser(user.id, id);
  }

  @Post(':id/messages')
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TicketMessageDtoIn,
  ) {
    return this.tickets.addUserMessage(user.id, id, dto);
  }
}
