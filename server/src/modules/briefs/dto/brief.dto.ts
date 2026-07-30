import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One answer change, as recorded by the questionnaire's autosave. */
export class BriefEventDto {
  @IsIn(['view', 'answer', 'tier', 'submit']) kind!:
    | 'view'
    | 'answer'
    | 'tier'
    | 'submit';

  @IsOptional() @IsString() @MaxLength(64) questionKey?: string;

  /** string for a single choice, string[] for a multi choice. */
  @IsOptional() value?: unknown;
}

/**
 * Debounced autosave from the questionnaire. `answers` is merged into the
 * stored map key by key, so a partial payload never wipes earlier answers.
 */
export class SaveBriefDto {
  @IsOptional() @IsObject() answers?: Record<string, unknown>;

  @IsOptional() @IsIn(['essentiel', 'business', 'signature', 'custom'])
  selectedTier?: string;

  @IsOptional() @IsInt() @Min(0) estimatedTotalCents?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100) progressPct?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BriefEventDto)
  events?: BriefEventDto[];
}

/** Final validation step — carries the closing block plus a last snapshot. */
export class SubmitBriefDto extends SaveBriefDto {
  @IsOptional() @IsString() @MaxLength(120) clientName?: string;
  @IsOptional() @IsEmail() @MaxLength(180) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) clientPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsString() @MaxLength(180) domainWish?: string;
  @IsOptional() @IsString() @MaxLength(60) timeline?: string;
  @IsOptional() @IsString() @MaxLength(60) budgetRange?: string;
  @IsOptional() @IsBoolean() validated?: boolean;
}

/** Owner-side: open a brief for a prospect and get back the link to send. */
export class CreateBriefDto {
  /** Lowercase link segment, e.g. 'azzedine'. Generated if omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(48)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Le slug ne peut contenir que des minuscules, chiffres et tirets',
  })
  slug?: string;

  @IsOptional() @IsString() @MaxLength(120) clientName?: string;
  @IsOptional() @IsEmail() @MaxLength(180) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(40) clientPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
}

/** Owner-side: pipeline status and private notes. */
export class UpdateBriefDto {
  @IsOptional() @IsIn(['draft', 'submitted', 'reviewed', 'won', 'lost'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(4000) internalNote?: string;
}
