import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { AdminConversationsService } from './admin-conversations.service';
import {
  AdminReplyDto,
  PinEntityDto,
} from './dto/conversation-admin.dto';

@Roles('admin', 'super_admin')
@Controller('admin/conversations')
export class AdminConversationsController {
  constructor(private readonly conversations: AdminConversationsService) {}

  @Get()
  list() {
    return this.conversations.list();
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.conversations.messages(id);
  }

  @Post(':id/messages')
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminReplyDto,
  ) {
    return this.conversations.reply(id, user.id, dto.content, dto.attachments);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@Param('id') id: string) {
    return this.conversations.markRead(id);
  }

  @Post(':id/pin')
  @HttpCode(200)
  pin(@Param('id') id: string, @Body() dto: PinEntityDto) {
    return this.conversations.pin(
      id,
      dto.kind ?? null,
      dto.ref ?? null,
      dto.label ?? null,
    );
  }
}
