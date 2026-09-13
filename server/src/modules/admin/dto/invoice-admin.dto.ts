import { IsBoolean, IsIn, IsOptional, Matches } from 'class-validator';

export class InvoiceExportQuery {
  /** Inclusive start of the period, `AAAA-MM-JJ`. Defaults to 1 January of the current year. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from doit être au format AAAA-MM-JJ' })
  from?: string;

  /** Inclusive end of the period, `AAAA-MM-JJ`. Defaults to the end of the current year. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to doit être au format AAAA-MM-JJ' })
  to?: string;

  /** `csv` for the ledger the comptable reconciles from, `zip` for the PDFs themselves. */
  @IsOptional()
  @IsIn(['csv', 'zip'])
  format?: 'csv' | 'zip' = 'csv';
}

export class EmailInvoiceDto {
  /** Re-send a facture already marked delivered (the customer says it never arrived). */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
