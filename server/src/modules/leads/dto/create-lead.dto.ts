import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * A submission from the landing site's contact form.
 *
 * `name`, `email` and `message` are mandatory on purpose: a lead nobody can
 * reply to is not a lead. Everything else is optional because a public form
 * that asks for more than it needs is a form fewer people finish.
 *
 * The global ValidationPipe runs with `whitelist: true` (`main.ts:28-34`), so
 * anything not declared here is stripped before the service sees it — which is
 * exactly what you want on a route the whole internet can POST to.
 */
export class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(120) nom!: string;

  @IsEmail() @MaxLength(180) email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  // Deliberately loose: French numbers are written +33 6 12 34 56 78,
  // 06.12.34.56.78 and 0612345678 by three different people, and rejecting any
  // of those spellings costs a lead to gain nothing.
  @Matches(/^[\d\s+().-]{6,40}$/, { message: 'Numéro de téléphone invalide' })
  telephone?: string;

  @IsOptional() @IsString() @MaxLength(10) codePostal?: string;

  @IsString() @MinLength(10) @MaxLength(4000) message!: string;

  @IsOptional() @IsIn(['site', 'quiz', 'showroom']) source?: string;

  /** Quiz answers, free-form — mirrors `website_briefs.answers`. */
  @IsOptional() @IsObject() reponses?: Record<string, unknown>;

  @IsOptional() @IsBoolean() consentement?: boolean;

  // ── Anti-abus. Jamais persistés tels quels. ───────────────────────────────

  /**
   * Honeypot. Hidden from people, irresistible to a form-filling bot. Any value
   * at all means the submission is discarded — silently, with a success
   * response, because an error is a training signal.
   */
  @IsOptional() @IsString() @MaxLength(200) siteWeb?: string;

  /**
   * Epoch milliseconds, stamped by the client when the form mounts. A
   * submission under three seconds old was not typed by a person.
   *
   * Forgeable, and meant to be understood as such: this filters unsophisticated
   * bots, it is not a security control. The non-forgeable version is an
   * HMAC-signed timestamp handed out by a `GET /leads/jeton`, which costs a
   * round trip and an uncacheable request — not worth it until abuse is
   * actually observed.
   */
  @IsOptional() @IsInt() ouvertureAt?: number;
}
