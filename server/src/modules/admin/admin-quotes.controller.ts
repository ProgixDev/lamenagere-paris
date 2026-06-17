import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { QuoteStatus } from '../../common/serialization/status-labels';
import { AdminQuotesService } from './admin-quotes.service';
import {
  UpdateQuoteDto,
  UpdateQuoteStatusDto,
} from './dto/quote-admin.dto';

@Roles('admin', 'super_admin', 'manager')
@Controller('admin/quotes')
export class AdminQuotesController {
  constructor(private readonly quotes: AdminQuotesService) {}

  @Get()
  list(@Query('status') status?: QuoteStatus) {
    return this.quotes.list(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.quotes.detail(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(id, dto);
  }

  @Post(':id/send')
  @HttpCode(200)
  send(@Param('id') id: string) {
    return this.quotes.send(id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string) {
    return this.quotes.reject(id);
  }

  @Put(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) {
    return this.quotes.setStatus(id, dto);
  }
}
