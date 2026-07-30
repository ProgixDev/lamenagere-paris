import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ActivityService } from '../../common/activity/activity.service';
import { AppleService } from './apple.service';
import {
  AddressRow,
  ProfileRow,
  toUserDto,
  UserDto,
} from './auth.serializer';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

export interface AuthResult {
  user: UserDto;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly activity: ActivityService,
    private readonly apple: AppleService,
  ) {}

  /**
   * Stores the Apple refresh token for this user so their grant can be revoked
   * when they delete their account (an Apple requirement). Called right after a
   * successful Sign in with Apple, with the one-time authorization code from the
   * native sheet. Best-effort: a failure must never break sign-in.
   */
  async linkApple(
    userId: string,
    authorizationCode: string,
  ): Promise<{ success: boolean }> {
    const refreshToken =
      await this.apple.exchangeAuthorizationCode(authorizationCode);
    if (!refreshToken) return { success: false };

    const { error } = await this.supabase.client
      .from('apple_auth_tokens')
      .upsert(
        { profile_id: userId, refresh_token: refreshToken },
        { onConflict: 'profile_id' },
      );
    return { success: !error };
  }

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error || !data.session || !data.user) {
      this.activity
        .log({
          kind: 'auth',
          actorEmail: dto.email,
          summary: `Tentative de connexion échouée — ${dto.email}`,
          action: 'LOGIN',
          ipAddress,
        })
        .catch(() => {});
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const user = await this.loadUser(data.user.id);
    this.activity
      .log({
        kind: 'auth',
        actorId: data.user.id,
        actorEmail: dto.email,
        summary: `Connexion — ${dto.email}`,
        action: 'LOGIN',
        ipAddress,
      })
      .catch(() => {});
    return { user, token: data.session.access_token };
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    // Create the user with email pre-confirmed; the auth trigger creates the
    // profile row from user_metadata.
    const { data, error } = await this.supabase.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        full_name: dto.fullName,
        phone: dto.phone,
        account_type: dto.accountType,
        company: dto.company,
        siret: dto.siret,
        // Registering through the app means the profile is already complete.
        onboarded: true,
      },
    });
    if (error || !data.user) {
      throw new BadRequestException(
        error?.message ?? 'Impossible de créer le compte',
      );
    }

    // Sign in to obtain an access token for the mobile client.
    const { data: session, error: signInError } =
      await this.supabase.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });
    if (signInError || !session.session) {
      throw new BadRequestException('Compte créé mais connexion impossible');
    }

    const user = await this.loadUser(data.user.id);
    return { user, token: session.session.access_token };
  }

  async changePassword(
    userId: string,
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    // Verify the current password before allowing a change.
    const { error: verifyError } = await this.supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    const { error } = await this.supabase.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) {
      throw new BadRequestException('Modification du mot de passe impossible');
    }
    return { success: true };
  }

  /**
   * Erases the account (App Store 5.1.1(v), GDPR art. 17).
   *
   * Orders and quotes are kept for accounting/tax retention but detached and
   * anonymised first: their personal columns are cleared here, then deleting
   * the auth user cascades the profile away and sets `profile_id` to NULL via
   * the FKs (see migration 0029). Everything else — addresses, tickets,
   * conversations, reviews, devices, promo redemptions — cascades from
   * `profiles`, so it disappears with the account.
   */
  async deleteAccount(userId: string): Promise<{ success: boolean }> {
    // Revoke the Sign in with Apple grant first — Apple requires this when an
    // app offers both Apple sign-in and account deletion. Read before deleting,
    // since the row cascades away with the profile. Best-effort by design: a
    // revocation failure must not trap the user in an undeletable account.
    const { data: appleToken } = await this.supabase.client
      .from('apple_auth_tokens')
      .select('refresh_token')
      .eq('profile_id', userId)
      .maybeSingle<{ refresh_token: string }>();
    if (appleToken?.refresh_token) {
      await this.apple.revokeRefreshToken(appleToken.refresh_token);
    }

    // Scrub the shipping identity snapshot from retained invoices. The
    // financial fields (totals, order_number, dates, territory) stay intact.
    const { error: ordersError } = await this.supabase.client
      .from('orders')
      .update({
        ship_first_name: null,
        ship_last_name: null,
        ship_street: null,
        ship_postal_code: null,
        ship_city: null,
        ship_country: null,
        ship_phone: null,
        customer_note: null,
        customer_attachments: [],
      })
      .eq('profile_id', userId);
    if (ordersError) {
      throw new BadRequestException(
        'Suppression impossible : réessayez ou contactez le support.',
      );
    }

    // Quote notes are free text written by the customer — clear them too.
    const { error: quotesError } = await this.supabase.client
      .from('quotes')
      .update({ notes: null })
      .eq('profile_id', userId);
    if (quotesError) {
      throw new BadRequestException(
        'Suppression impossible : réessayez ou contactez le support.',
      );
    }

    const { error } = await this.supabase.admin.deleteUser(userId);
    if (error) {
      throw new BadRequestException(
        'Suppression impossible : réessayez ou contactez le support.',
      );
    }
    return { success: true };
  }

  async logout(): Promise<void> {
    // Tokens are stateless JWTs; the client discards them. Nothing to do
    // server-side beyond acknowledging. (Refresh-token revocation could be
    // added via admin.signOut if refresh tokens are stored later.)
    return;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(dto.email);
    // Do not leak whether the email exists.
    if (error) return { success: true };
    return { success: true };
  }

  async getProfile(userId: string): Promise<UserDto> {
    return this.loadUser(userId);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDto> {
    const patch: Record<string, unknown> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.accountType !== undefined) patch.account_type = dto.accountType;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.company !== undefined) patch.company = dto.company;
    if (dto.siret !== undefined) patch.siret = dto.siret;
    if (dto.onboarded !== undefined) patch.onboarded = dto.onboarded;
    if (dto.deliveryAddress !== undefined) {
      patch.delivery_address = dto.deliveryAddress;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await this.supabase.client
        .from('profiles')
        .update(patch)
        .eq('id', userId);
      if (error) {
        throw new BadRequestException('Mise à jour du profil impossible');
      }
    }
    return this.loadUser(userId);
  }

  /** Loads a profile + its addresses and maps to the mobile User shape. */
  private async loadUser(userId: string): Promise<UserDto> {
    const { data: profile, error } = await this.supabase.client
      .from('profiles')
      .select(
        'id, email, full_name, phone, account_type, company, siret, onboarded, delivery_address, created_at',
      )
      .eq('id', userId)
      .single<ProfileRow>();
    if (error || !profile) {
      throw new NotFoundException('Profil introuvable');
    }

    const { data: addresses } = await this.supabase.client
      .from('addresses')
      .select(
        'id, first_name, last_name, street, postal_code, city, country, territory, is_default',
      )
      .eq('profile_id', userId)
      .order('is_default', { ascending: false })
      .returns<AddressRow[]>();

    return toUserDto(profile, addresses ?? []);
  }
}
