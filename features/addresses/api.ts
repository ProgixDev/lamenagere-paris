import { apiClient } from "../../lib/api";
import type { Address, ShippingZone } from "../../lib/types";

export type AddressInput = {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country?: string;
  territory: ShippingZone;
  isDefault?: boolean;
};

export const getAddressesApi = async (): Promise<Address[]> => {
  const { data } = await apiClient.get<Address[]>("/addresses");
  return data;
};

export const createAddressApi = async (
  payload: AddressInput,
): Promise<Address> => {
  const { data } = await apiClient.post<Address>("/addresses", payload);
  return data;
};

export const updateAddressApi = async (
  addressId: string,
  payload: Partial<AddressInput>,
): Promise<Address> => {
  const { data } = await apiClient.put<Address>(
    `/addresses/${addressId}`,
    payload,
  );
  return data;
};

export const deleteAddressApi = async (addressId: string): Promise<void> => {
  await apiClient.delete(`/addresses/${addressId}`);
};

export const setDefaultAddressApi = async (
  addressId: string,
): Promise<Address> => {
  const { data } = await apiClient.post<Address>(
    `/addresses/${addressId}/default`,
  );
  return data;
};
