import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DevicesService } from './devices.service';

/**
 * Global so the admin campaigns service (and future transactional pushes) can
 * inject NotificationsService / DevicesService without re-importing.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, DevicesService],
  exports: [NotificationsService, DevicesService],
})
export class NotificationsModule {}
