import { AccountType, ShippingZone } from '../../common/serialization/status-labels';

/** DB row shapes (snake_case) for profiles + addresses. */
export interface DeliveryAddress {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  phone?: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  account_type: AccountType;
  company: string | null;
  siret: string | null;
  onboarded: boolean;
  delivery_address: DeliveryAddress | null;
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
  phone?: string;
  isDefault?: boolean;
}

/** Mobile canonical User (lib/types.ts). */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  accountType: AccountType;
  company?: string;
  siret?: string;
  onboarded: boolean;
  addresses: AddressDto[];
  /** Remembered checkout delivery form (pre-fills the next order). */
  deliveryAddress?: DeliveryAddress;
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
    fullName: profile.full_name,
    phone: profile.phone ?? undefined,
    accountType: profile.account_type,
    company: profile.company ?? undefined,
    siret: profile.siret ?? undefined,
    onboarded: profile.onboarded,
    addresses: addresses.map(toAddressDto),
    deliveryAddress: profile.delivery_address ?? undefined,
    createdAt: profile.created_at,
  };
}
