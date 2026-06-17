import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { ActivityService } from '../../common/activity/activity.service';
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
  ) {}

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
        first_name: dto.firstName,
        last_name: dto.lastName,
        phone: dto.phone,
        account_type: dto.accountType,
        company: dto.company,
        siret: dto.siret,
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
    if (dto.firstName !== undefined) patch.first_name = dto.firstName;
    if (dto.lastName !== undefined) patch.last_name = dto.lastName;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.company !== undefined) patch.company = dto.company;
    if (dto.siret !== undefined) patch.siret = dto.siret;

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
        'id, email, first_name, last_name, phone, account_type, company, siret, created_at',
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
