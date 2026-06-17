import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminReplyDto {
  @IsString() @MinLength(1) content!: string;
  @IsOptional() @IsArray() attachments?: string[];
}

export class PinEntityDto {
  @IsOptional() @IsEnum(['order', 'quote']) kind?: 'order' | 'quote';
  @IsOptional() @IsString() ref?: string;
  @IsOptional() @IsString() label?: string;
}
