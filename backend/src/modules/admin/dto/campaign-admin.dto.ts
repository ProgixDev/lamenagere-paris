import { Type } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CampaignAudienceDto {
  @IsOptional() @IsEnum(['particulier', 'professionnel']) accountType?:
    | 'particulier'
    | 'professionnel';
  @IsOptional() @IsString() territory?: string;
}

export class UpsertCampaignDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignAudienceDto)
  audience?: CampaignAudienceDto;
  @IsOptional() @IsObject() link?: Record<string, string>;
  @IsOptional() @IsString() scheduledAt?: string;
}
