import { apiClient } from "../../lib/api";
import type { Category, PaginatedResponse, Product } from "../../lib/types";

export const getCategoriesApi = async (): Promise<Category[]> => {
  const { data } = await apiClient.get<Category[]>("/categories");
  return data;
};

export const getProductsByCategoryApi = async (
  categoryId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Product>> => {
  const { data } = await apiClient.get<PaginatedResponse<Product>>(
    `/categories/${categoryId}/products`,
    { params: { page, limit } },
  );
  return data;
};

export const getProductByIdApi = async (
  productId: string,
): Promise<Product> => {
  const { data } = await apiClient.get<Product>(`/products/${productId}`);
  return data;
};

export const searchProductsApi = async (
  query: string,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Product>> => {
  const { data } = await apiClient.get<PaginatedResponse<Product>>(
    "/products/search",
    { params: { q: query, page, limit } },
  );
  return data;
};

export const getPopularProductsApi = async (
  limit = 10,
): Promise<Product[]> => {
  const { data } = await apiClient.get<Product[]>("/products/popular", {
    params: { limit },
  });
  return data;
};

/** Batch fetch published products by id, in the requested order. */
export const getProductsByIdsApi = async (
  ids: string[],
): Promise<Product[]> => {
  if (ids.length === 0) return [];
  const { data } = await apiClient.get<Product[]>("/products/by-ids", {
    params: { ids: ids.join(",") },
  });
  return data;
};
