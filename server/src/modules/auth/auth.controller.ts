import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Req,
  Post,
  Put,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { AuthService } from './auth.service';
import { AuthThrottleService } from './auth-throttle.service';
import { clientIp } from '../../common/http/client-ip.util';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LinkAppleDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly debit: AuthThrottleService,
  ) {}

  /**
   * ⚠️ L'adresse vient des en-têtes, **pas** de `@Ip()`.
   *
   * `client-ip.util.ts` l'explique en détail : l'adaptateur Fastify est
   * construit sans `trustProxy`, donc `@Ip()` rend l'adresse de la socket. Sur
   * Vercel, toutes les requêtes arrivent par le proxy de la plateforme, et
   * `@Ip()` rend donc **la même adresse interne pour tout le monde**. Un
   * plafond calé dessus limiterait l'internet entier comme un seul client —
   * autrement dit, il fermerait la connexion à tous au premier robot.
   *
   * Le journal d'activité recevait déjà cette adresse inutile ; il reçoit
   * maintenant la vraie, au passage.
   */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    const ip = clientIp(req.headers, req.ip);
    await this.debit.verifier('login', ip, dto.email);
    try {
      const resultat = await this.auth.login(dto, ip);
      await this.debit.enregistrer('login', ip, dto.email, true);
      return resultat;
    } catch (e) {
      await this.debit.enregistrer('login', ip, dto.email, false);
      throw e;
    }
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    const ip = clientIp(req.headers, req.ip);
    await this.debit.verifier('register', ip, dto.email);
    try {
      const resultat = await this.auth.register(dto);
      await this.debit.enregistrer('register', ip, dto.email, true);
      return resultat;
    } catch (e) {
      // Une création refusée compte : c'est ainsi qu'on repère quelqu'un qui
      // essaie des adresses en série pour savoir lesquelles existent déjà.
      await this.debit.enregistrer('register', ip, dto.email, false);
      throw e;
    }
  }

  /**
   * Renews an expired access token.
   *
   * `@Public()` by necessity: the caller's bearer is expired, which is why it
   * is calling. The refresh token in the body is the credential.
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout() {
    return this.auth.logout();
  }

  /**
   * Chaque appel envoie un courriel. Le plafond protège donc deux choses : la
   * boîte du client, qu'un tiers pourrait inonder, et la réputation du domaine
   * d'envoi, qu'une salve fait basculer en indésirable.
   *
   * L'échec est enregistré quoi qu'il arrive : cette route répond toujours 200,
   * qu'il existe un compte ou non — c'est volontaire, sans quoi elle
   * indiquerait quelles adresses sont inscrites — donc « réussi » ne veut rien
   * dire ici et ne doit pas remettre le compteur à zéro.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: FastifyRequest,
  ) {
    const ip = clientIp(req.headers, req.ip);
    await this.debit.verifier('forgot', ip, dto.email);
    const resultat = await this.auth.forgotPassword(dto);
    await this.debit.enregistrer('forgot', ip, dto.email, false);
    return resultat;
  }

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      user.id,
      user.email,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /**
   * Records the Apple grant so it can be revoked on account deletion. Called by
   * the app right after a successful Sign in with Apple.
   */
  @Post('apple/link')
  @HttpCode(200)
  linkApple(@CurrentUser() user: AuthUser, @Body() dto: LinkAppleDto) {
    return this.auth.linkApple(user.id, dto.authorizationCode);
  }

  @Delete('account')
  @HttpCode(200)
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.auth.deleteAccount(user.id);
  }
}
