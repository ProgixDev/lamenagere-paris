import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString() @MinLength(1) content!: string;

  /** URLs already uploaded via the media endpoint. */
  @IsOptional() @IsArray() attachments?: string[];
}
