import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminPopupsService } from './admin-popups.service';
import { ReorderPopupsDto, UpsertPopupDto } from './dto/popup-admin.dto';

@Roles('admin', 'super_admin', 'editor')
@Controller('admin/popups')
export class AdminPopupsController {
  constructor(private readonly popups: AdminPopupsService) {}

  @Get()
  list() {
    return this.popups.list();
  }

  @Post()
  create(@Body() dto: UpsertPopupDto) {
    return this.popups.create(dto);
  }

  @Post('reorder')
  @HttpCode(200)
  reorder(@Body() dto: ReorderPopupsDto) {
    return this.popups.reorder(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertPopupDto) {
    return this.popups.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.popups.remove(id);
  }
}
