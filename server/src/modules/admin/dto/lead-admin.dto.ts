import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Triage from the back office. Nothing a visitor sent can be edited here. */
export class UpdateLeadDto {
  @IsOptional()
  @IsIn(['nouveau', 'contacte', 'qualifie', 'converti', 'spam', 'clos'])
  statut?: string;

  @IsOptional() @IsString() @MaxLength(4000) noteInterne?: string;
}
