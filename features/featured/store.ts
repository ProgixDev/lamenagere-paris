import type { CarouselSlide, PromoBanner } from "../../lib/types";
import { useHome, usePopularProducts } from "../products/hooks";

export type HeroSlide = {
  id: string;
  kind: "image" | "video";
  src: string;
  title?: string;
  subtitle?: string;
  productId?: string;
  categoryId?: string;
};

const toHeroSlide = (s: CarouselSlide): HeroSlide => ({
  id: s.id,
  kind: s.kind,
  src: s.mediaUrl,
  title: s.title,
  subtitle: s.subtitle,
  productId: s.linkKind === "product" ? s.linkProductId : undefined,
  categoryId: s.linkKind === "category" ? s.linkCategoryId : undefined,
});

/**
 * Customer-facing "featured / best-sellers" list, sourced from the admin's
 * curated selection (GET /home). Falls back to the popular-products endpoint
 * only when the admin hasn't featured anything yet, so the home is never empty.
 */
export const useFeaturedProducts = () => {
  const { data } = useHome();
  const { data: popular } = usePopularProducts(12);
  const featured = data?.featured ?? [];
  return featured.length > 0 ? featured : (popular ?? []);
};

/** Admin-curated hero carousel slides (GET /home). */
export const useHeroSlides = (): HeroSlide[] => {
  const { data } = useHome();
  return (data?.carousel ?? []).map(toHeroSlide);
};

/** Admin-curated promo banners (GET /home). */
export const usePromoBanners = (): PromoBanner[] => {
  const { data } = useHome();
  return data?.banners ?? [];
};
