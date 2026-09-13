import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminInvoicesService } from './admin-invoices.service';
import { EmailInvoiceDto, InvoiceExportQuery } from './dto/invoice-admin.dto';

@Roles('admin', 'super_admin', 'manager')
@Controller('admin/invoices')
export class AdminInvoicesController {
  constructor(private readonly invoices: AdminInvoicesService) {}

  /**
   * The comptabilité export: a CSV ledger, or a ZIP of the PDF factures with
   * the same ledger inside it. Missing factures are generated on the way out.
   */
  @Get('export')
  async export(@Query() query: InvoiceExportQuery, @Res() reply: FastifyReply) {
    const { filename, contentType, body } = await this.invoices.export(query);
    void reply
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(body);
  }

  /** Signed link to one order's facture, generated on the spot if missing. */
  @Get('order/:orderId')
  link(@Param('orderId') orderId: string) {
    return this.invoices.linkForOrder(orderId);
  }

  /** Sends the facture to the customer — `force` re-sends an already-delivered one. */
  @Post('order/:orderId/email')
  @HttpCode(200)
  email(@Param('orderId') orderId: string, @Body() dto: EmailInvoiceDto) {
    return this.invoices.emailForOrder(orderId, dto?.force === true);
  }
}
