import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { UserRole } from '../../common/auth/auth-user';
import {
  AdminUserDto,
  CreateAdminUserDto,
  UpdateAdminRoleDto,
} from './dto/user-admin.dto';

interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  last_activity_at: string | null;
  created_at: string;
}

function toDto(p: ProfileRow): AdminUserDto {
  return {
    id: p.id,
    email: p.email,
    firstName: p.first_name,
    lastName: p.last_name,
    role: p.role,
    lastActivityAt: p.last_activity_at,
    createdAt: p.created_at,
  };
}

const ADMIN_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'manager',
  'editor',
  'support',
];

@Injectable()
export class AdminUsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AdminUserDto[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select(
        'id, email, first_name, last_name, role, last_activity_at, created_at',
      )
      .in('role', ADMIN_ROLES)
      .order('created_at', { ascending: false })
      .returns<ProfileRow[]>();

    if (error) throw new BadRequestException('Impossible de charger les utilisateurs');
    return (data ?? []).map(toDto);
  }

  async create(dto: CreateAdminUserDto): Promise<AdminUserDto> {
    const { data, error } = await this.supabase.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        first_name: dto.firstName,
        last_name: dto.lastName,
      },
    });

    if (error || !data.user) {
      throw new BadRequestException(
        error?.message ?? 'Impossible de créer le compte',
      );
    }

    await this.supabase.client
      .from('profiles')
      .update({ role: dto.role })
      .eq('id', data.user.id);

    return this.getOne(data.user.id);
  }

  async updateRole(id: string, dto: UpdateAdminRoleDto): Promise<AdminUserDto> {
    const { error } = await this.supabase.client
      .from('profiles')
      .update({ role: dto.role })
      .eq('id', id)
      .in('role', ADMIN_ROLES);

    if (error) throw new BadRequestException('Mise à jour impossible');
    return this.getOne(id);
  }

  async revoke(id: string, requestorId: string): Promise<void> {
    if (id === requestorId) {
      throw new BadRequestException('Impossible de révoquer votre propre accès');
    }

    const { error: profileError } = await this.supabase.client
      .from('profiles')
      .update({ role: 'customer' })
      .eq('id', id)
      .in('role', ADMIN_ROLES);

    if (profileError) throw new BadRequestException('Révocation impossible');

    // Also delete the auth user so they cannot log back in.
    await this.supabase.admin.deleteUser(id);
  }

  private async getOne(id: string): Promise<AdminUserDto> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select(
        'id, email, first_name, last_name, role, last_activity_at, created_at',
      )
      .eq('id', id)
      .single<ProfileRow>();

    if (error || !data) throw new NotFoundException('Utilisateur introuvable');
    return toDto(data);
  }
}
