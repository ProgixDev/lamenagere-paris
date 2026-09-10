import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { clientIp } from '../../common/http/client-ip.util';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';

/**
 * The cookie banner's receipt.
 *
 * `@Public()` for the same reason as `leads`: there is no session on a landing
 * page. Reading is elsewhere (`admin/consentements`), so nothing here can list
 * what has been stored.
 *
 * `@Ip()` is a last resort: without `trustProxy` on the Fastify adapter it
 * reports the platform's own address on Vercel — `clientIp()` reads the
 * forwarding headers first. See `client-ip.util.ts`.
 */
@Public()
@Controller('consentements')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  /** 202: accepted once written. The browser never reads the body. */
  @Post()
  @HttpCode(202)
  enregistrer(
    @Body() dto: CreateConsentDto,
    @Headers() enTetes: Record<string, string | string[] | undefined>,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.consents.enregistrer(dto, {
      ip: clientIp(enTetes, ip),
      userAgent,
    });
  }
}
