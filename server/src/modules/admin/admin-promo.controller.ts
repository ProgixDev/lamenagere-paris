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
import { AdminPromoService } from './admin-promo.service';
import { UpsertPromoCodeDto } from './dto/promo-admin.dto';

@Roles('admin', 'super_admin')
@Controller('admin/promo-codes')
export class AdminPromoController {
  constructor(private readonly promo: AdminPromoService) {}

  @Get()
  list() {
    return this.promo.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: UpsertPromoCodeDto) {
    return this.promo.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertPromoCodeDto) {
    return this.promo.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.promo.remove(id);
  }
}
