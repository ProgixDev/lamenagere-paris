import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class AdminReplyDto {
  /** Optional when the reply carries attachments only. */
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() attachments?: string[];
}

export class PinEntityDto {
  @IsOptional() @IsEnum(['order', 'quote']) kind?: 'order' | 'quote';
  @IsOptional() @IsString() ref?: string;
  @IsOptional() @IsString() label?: string;
}
