import { Global, Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

/**
 * Global : le module admin des paramètres injecte AppVersionService pour vider
 * son cache dès qu'on modifie la version minimale.
 */
@Global()
@Module({
  controllers: [AppVersionController],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
