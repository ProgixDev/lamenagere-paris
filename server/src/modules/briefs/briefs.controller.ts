import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { BriefsService } from './briefs.service';
import {
  CreateBriefDto,
  SaveBriefDto,
  SubmitBriefDto,
  UpdateBriefDto,
} from './dto/brief.dto';

/**
 * Website scoping questionnaire (see migration 0028).
 *
 * Two audiences, no Supabase session on either side:
 *  - the prospect opens `?t=<token>` and only ever sees their own brief;
 *  - we open the console with `?k=<BRIEF_OWNER_KEY>`.
 *
 * Both credentials are checked in BriefsService, which is why the whole
 * controller is @Public() — the global AuthGuard has nothing to authenticate.
 */
@Public()
@Controller('briefs')
export class BriefsController {
  constructor(private readonly briefs: BriefsService) {}

  // ── Owner console ─────────────────────────────────────────────────────────

  @Get()
  list(@Query('k') key: string) {
    return this.briefs.list(key);
  }

  @Post()
  create(@Query('k') key: string, @Body() dto: CreateBriefDto) {
    return this.briefs.create(key, dto);
  }

  @Get(':slug/full')
  full(@Param('slug') slug: string, @Query('k') key: string) {
    return this.briefs.full(key, slug);
  }

  @Put(':slug')
  update(
    @Param('slug') slug: string,
    @Query('k') key: string,
    @Body() dto: UpdateBriefDto,
  ) {
    return this.briefs.update(key, slug, dto);
  }

  // ── Prospect ──────────────────────────────────────────────────────────────

  @Get(':slug')
  open(
    @Param('slug') slug: string,
    @Query('t') token: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.briefs.open(slug, token, ip, userAgent);
  }

  @Patch(':slug')
  save(
    @Param('slug') slug: string,
    @Query('t') token: string,
    @Body() dto: SaveBriefDto,
  ) {
    return this.briefs.save(slug, token, dto);
  }

  @Post(':slug/submit')
  @HttpCode(200)
  submit(
    @Param('slug') slug: string,
    @Query('t') token: string,
    @Body() dto: SubmitBriefDto,
  ) {
    return this.briefs.submit(slug, token, dto);
  }
}
