import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  AddressDto,
  AddressRow,
  toAddressDto,
} from '../auth/auth.serializer';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

const ADDRESS_COLS =
  'id, first_name, last_name, street, postal_code, city, country, territory, is_default';

@Injectable()
export class AddressesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(userId: string): Promise<AddressDto[]> {
    const { data } = await this.supabase.client
      .from('addresses')
      .select(ADDRESS_COLS)
      .eq('profile_id', userId)
      .order('is_default', { ascending: false })
      .returns<AddressRow[]>();
    return (data ?? []).map(toAddressDto);
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressDto> {
    if (dto.isDefault) await this.clearDefault(userId);
    const { data, error } = await this.supabase.client
      .from('addresses')
      .insert({
        profile_id: userId,
        first_name: dto.firstName,
        last_name: dto.lastName,
        street: dto.street,
        postal_code: dto.postalCode,
        city: dto.city,
        country: dto.country ?? 'France',
        territory: dto.territory,
        is_default: dto.isDefault ?? false,
      })
      .select(ADDRESS_COLS)
      .single<AddressRow>();
    if (error || !data) {
      throw new BadRequestException('Création de l’adresse impossible');
    }
    return toAddressDto(data);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    await this.assertOwned(userId, id);
    if (dto.isDefault) await this.clearDefault(userId);

    const patch: Record<string, unknown> = {};
    if (dto.firstName !== undefined) patch.first_name = dto.firstName;
    if (dto.lastName !== undefined) patch.last_name = dto.lastName;
    if (dto.street !== undefined) patch.street = dto.street;
    if (dto.postalCode !== undefined) patch.postal_code = dto.postalCode;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.country !== undefined) patch.country = dto.country;
    if (dto.territory !== undefined) patch.territory = dto.territory;
    if (dto.isDefault !== undefined) patch.is_default = dto.isDefault;

    const { data, error } = await this.supabase.client
      .from('addresses')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', userId)
      .select(ADDRESS_COLS)
      .single<AddressRow>();
    if (error || !data) {
      throw new BadRequestException('Mise à jour de l’adresse impossible');
    }
    return toAddressDto(data);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    await this.supabase.client
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('profile_id', userId);
  }

  async setDefault(userId: string, id: string): Promise<AddressDto> {
    await this.assertOwned(userId, id);
    await this.clearDefault(userId);
    const { data, error } = await this.supabase.client
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .eq('profile_id', userId)
      .select(ADDRESS_COLS)
      .single<AddressRow>();
    if (error || !data) {
      throw new BadRequestException('Impossible de définir l’adresse par défaut');
    }
    return toAddressDto(data);
  }

  private async clearDefault(userId: string): Promise<void> {
    await this.supabase.client
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', userId)
      .eq('is_default', true);
  }

  private async assertOwned(userId: string, id: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('addresses')
      .select('id')
      .eq('id', id)
      .eq('profile_id', userId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Adresse introuvable');
  }
}
