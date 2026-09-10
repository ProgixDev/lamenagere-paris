import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const ACTIONS_CONSENTEMENT = [
  'accepter_tout',
  'refuser_tout',
  'personnaliser',
  'retirer',
] as const;

export type ActionConsentement = (typeof ACTIONS_CONSENTEMENT)[number];

/** Les deux catégories soumises au consentement. « Nécessaires » est implicite. */
export class ChoixDto {
  @IsBoolean() mesure!: boolean;
  @IsBoolean() marketing!: boolean;
}

/**
 * Un reçu de consentement, envoyé par la bannière cookies du site.
 *
 * Rien ici n'identifie une personne : `consentId` est un uuid tiré au sort par
 * le navigateur et conservé dans son cookie, `page` est un chemin sans
 * paramètres. Le pipe global tourne avec `whitelist: true` (`main.ts`), donc
 * tout champ non déclaré est retiré avant d'atteindre le service.
 */
export class CreateConsentDto {
  @IsUUID('4') consentId!: string;

  /** La version de la politique, `AAAA-MM`, telle que `VERSION` côté site. */
  @IsString() @Matches(/^\d{4}-\d{2}$/) version!: string;

  @IsIn(ACTIONS_CONSENTEMENT) action!: ActionConsentement;

  @ValidateNested() @Type(() => ChoixDto) choix!: ChoixDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^\/[^?#]*$/, { message: 'page doit être un chemin sans paramètres' })
  page?: string;
}
