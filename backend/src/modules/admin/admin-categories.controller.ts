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
import { AdminCategoriesService } from './admin-categories.service';
import { ReorderDto, UpsertCategoryDto } from './dto/category-admin.dto';

@Roles('admin', 'super_admin', 'editor')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body() dto: UpsertCategoryDto) {
    return this.categories.create(dto);
  }

  @Post('reorder')
  @HttpCode(200)
  reorder(@Body() dto: ReorderDto) {
    return this.categories.reorder(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
