import { IsString, IsUUID } from 'class-validator';

export class CreateIntentDto {
  @IsString()
  @IsUUID()
  orderId!: string;
}
