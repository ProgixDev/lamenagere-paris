import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestRefundDto {
  /** Optional free-text reason the customer gives for the refund. */
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
