import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { AppVersionService } from './app-version.service';

/**
 * Verrou de version consulté par l'app mobile à chaque lancement (et à chaque
 * retour au premier plan). Public : l'écran bloquant doit pouvoir s'afficher
 * avant même la connexion, sinon une version vulnérable resterait utilisable
 * en mode invité.
 */
@Controller('app-version')
export class AppVersionController {
  constructor(private readonly appVersion: AppVersionService) {}

  @Public()
  @Get()
  check(
    @Query('platform') platform?: string,
    @Query('version') version?: string,
  ) {
    return this.appVersion.check(platform, version);
  }
}
