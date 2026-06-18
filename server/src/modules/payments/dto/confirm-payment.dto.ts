import { IsString, IsUUID } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsUUID()
  orderId!: string;
}
