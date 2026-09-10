import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminConsentsService } from './admin-consents.service';

/** `GET /admin/consentements?consentId=<uuid>` — every receipt for one visitor. */
@Roles('admin', 'super_admin', 'manager')
@Controller('admin/consentements')
export class AdminConsentsController {
  constructor(private readonly consents: AdminConsentsService) {}

  @Get()
  historique(@Query('consentId') consentId?: string) {
    if (!consentId || !isUUID(consentId, '4')) {
      throw new BadRequestException('consentId (uuid v4) est requis');
    }
    return this.consents.historique(consentId);
  }
}
