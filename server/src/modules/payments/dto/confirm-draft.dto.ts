import { IsString, IsUUID } from 'class-validator';

export class ConfirmDraftDto {
  @IsString()
  @IsUUID()
  draftId!: string;
}
