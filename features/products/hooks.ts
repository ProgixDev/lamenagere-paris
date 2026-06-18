import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  getCategoriesApi,
  getPopularProductsApi,
  getProductByIdApi,
  getProductsByCategoryApi,
  getProductsByIdsApi,
  searchProductsApi,
} from "./api";

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: getCategoriesApi,
    staleTime: 5 * 60 * 1000,
  });

export const useProductsByCategory = (categoryId: string) =>
  useInfiniteQuery({
    queryKey: ["products", "category", categoryId],
    queryFn: ({ pageParam = 1 }) =>
      getProductsByCategoryApi(categoryId, pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });

export const useProduct = (productId: string) =>
  useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProductByIdApi(productId),
    staleTime: 5 * 60 * 1000,
    enabled: !!productId,
  });

export const usePopularProducts = (limit = 10) =>
  useQuery({
    queryKey: ["products", "popular", limit],
    queryFn: () => getPopularProductsApi(limit),
    staleTime: 5 * 60 * 1000,
  });

/** Fetch a set of products by id (favorites, featured). */
export const useProductsByIds = (ids: string[]) =>
  useQuery({
    queryKey: ["products", "by-ids", [...ids].sort()],
    queryFn: () => getProductsByIdsApi(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

export const useSearchProducts = (query: string) =>
  useInfiniteQuery({
    queryKey: ["products", "search", query],
    queryFn: ({ pageParam = 1 }) => searchProductsApi(query, pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: query.length > 2,
    staleTime: 2 * 60 * 1000,
  });
