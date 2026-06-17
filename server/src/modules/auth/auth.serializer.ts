import { AccountType, ShippingZone } from '../../common/serialization/status-labels';

/** DB row shapes (snake_case) for profiles + addresses. */
export interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  account_type: AccountType;
  company: string | null;
  siret: string | null;
  created_at: string;
}

export interface AddressRow {
  id: string;
  first_name: string;
  last_name: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  territory: ShippingZone;
  is_default: boolean;
}

/** Mobile canonical Address (lib/types.ts). */
export interface AddressDto {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  territory: ShippingZone;
  isDefault?: boolean;
}

/** Mobile canonical User (lib/types.ts). */
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  accountType: AccountType;
  company?: string;
  siret?: string;
  addresses: AddressDto[];
  createdAt: string;
}

export function toAddressDto(row: AddressRow): AddressDto {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    territory: row.territory,
    isDefault: row.is_default,
  };
}

export function toUserDto(
  profile: ProfileRow,
  addresses: AddressRow[] = [],
): UserDto {
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone ?? undefined,
    accountType: profile.account_type,
    company: profile.company ?? undefined,
    siret: profile.siret ?? undefined,
    addresses: addresses.map(toAddressDto),
    createdAt: profile.created_at,
  };
}
