import { IsArray, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  /** Optional when the message carries attachments only. */
  @IsOptional() @IsString() content?: string;

  /** URLs already uploaded via the upload endpoint. */
  @IsOptional() @IsArray() attachments?: string[];
}
