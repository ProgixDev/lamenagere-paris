import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { clientIp } from '../../common/http/client-ip.util';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

/**
 * The landing site's contact form.
 *
 * The whole controller is `@Public()`, like `briefs`: there is no session to
 * authenticate on a landing page. `POST /quotes` and `POST /tickets` both
 * require `@CurrentUser()`, which is why neither could serve this — a visitor
 * who has not signed up is exactly the visitor this form exists for.
 *
 * ⚠️ **CORS protects nothing here.** `main.ts` sets `origin: true` and reflects
 * any origin, and CORS is a browser convention regardless — curl, a script and
 * anything that is not a browser ignore it entirely. The honeypot, the
 * time-on-page check and the per-IP window counted in Postgres are the whole
 * defence. See `leads.service.ts`.
 *
 * `@Ip()` is passed only as a last resort. Without `trustProxy` on the Fastify
 * adapter it reports the same platform address for every visitor on Vercel, so
 * `clientIp()` reads the forwarding headers first — see the comment there.
 */
@Public()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /**
   * 202, not 201: the request has succeeded once the row is written. Whether
   * SMTP then delivered is not the caller's business, and must never be able to
   * turn a recorded lead into an error the visitor sees.
   */
  @Post()
  @HttpCode(202)
  creer(
    @Body() dto: CreateLeadDto,
    @Headers() enTetes: Record<string, string | string[] | undefined>,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referer: string,
  ) {
    return this.leads.creer(dto, {
      ip: clientIp(enTetes, ip),
      userAgent,
      referer,
    });
  }
}
