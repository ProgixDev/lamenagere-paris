import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class StartConversationDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;

  /** Optional product the customer is asking about. */
  @IsOptional() @IsUUID() productId?: string;
}
