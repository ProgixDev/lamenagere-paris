import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AccountType, AuthUser, UserRole } from './auth-user';

/**
 * Validates the Supabase-issued access token (Authorization: Bearer <jwt>) by
 * asking GoTrue who it belongs to, then loads the user's role + account_type
 * from `profiles` and attaches an AuthUser to the request. Routes annotated
 * with @Public() skip this entirely.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const token = this.extractToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Token d’authentification manquant');
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('role, account_type')
      .eq('id', data.user.id)
      .single();

    request.user = {
      id: data.user.id,
      email: data.user.email ?? '',
      role: (profile?.role as UserRole) ?? 'customer',
      accountType: (profile?.account_type as AccountType) ?? 'particulier',
    };

    return true;
  }

  private extractToken(
    header: string | string[] | undefined,
  ): string | undefined {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) return undefined;
    const [scheme, token] = value.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
