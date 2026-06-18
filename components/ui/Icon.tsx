import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Boat,
  CaretLeft,
  CaretRight,
  ChatCircle,
  ChatText,
  Check,
  CheckCircle,
  CurrencyEur,
  Eye,
  EyeSlash,
  FileText,
  Gear,
  Gift,
  Handshake,
  Lifebuoy,
  Heart,
  House,
  ImageBroken,
  Info,
  Lightning,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  Minus,
  Package,
  PencilSimple,
  Plus,
  Question,
  Ruler,
  ShareNetwork,
  ShieldCheck,
  ShoppingCart,
  ThumbsUp,
  SignOut,
  SquaresFour,
  Star,
  Translate,
  Truck,
  User,
  UserMinus,
  WarningCircle,
  X,
  type IconProps as PhosphorIconProps,
  type IconWeight,
} from "phosphor-react-native";
import { COLORS } from "../../lib/constants";

type PhosphorComponent = React.ComponentType<PhosphorIconProps>;

// Each entry maps a name (mostly the MaterialCommunityIcons names already used
// across the app, so call sites need only swap the component) to a Phosphor
// icon plus an optional default weight ("fill" for the solid/active variants).
type Entry = { C: PhosphorComponent; weight?: IconWeight };

const MAP: Record<string, Entry> = {
  // navigation / chrome
  "chevron-left": { C: CaretLeft },
  "chevron-right": { C: CaretRight },
  "arrow-left": { C: ArrowLeft },
  "arrow-right": { C: ArrowRight },
  close: { C: X },
  menu: { C: List },
  magnify: { C: MagnifyingGlass },
  "share-variant": { C: ShareNetwork },
  "information-outline": { C: Info },
  "pencil-outline": { C: PencilSimple },
  logout: { C: SignOut },

  // commerce
  "image-off-outline": { C: ImageBroken },
  "truck-outline": { C: Truck },
  ferry: { C: Boat },
  "shield-check-outline": { C: ShieldCheck },
  "cart-check": { C: ShoppingCart, weight: "fill" },
  shopping: { C: ShoppingCart, weight: "fill" },
  "shopping-outline": { C: ShoppingCart },
  package: { C: Package },
  "package-variant-closed": { C: Package },
  "map-marker-outline": { C: MapPin },
  "map-marker": { C: MapPin, weight: "fill" },
  "gift-outline": { C: Gift },
  "cart-plus": { C: ShoppingCart },
  "ruler-square": { C: Ruler },
  "lightning-bolt": { C: Lightning, weight: "fill" },
  "thumb-up": { C: ThumbsUp },

  // hearts / favourites
  heart: { C: Heart, weight: "fill" },
  "heart-outline": { C: Heart },

  // messaging
  "message-outline": { C: ChatCircle },
  "message-text-outline": { C: ChatText },
  chat: { C: ChatCircle, weight: "fill" },
  "chat-outline": { C: ChatCircle },

  // account / settings
  "account-outline": { C: User },
  account: { C: User, weight: "fill" },
  "account-remove-outline": { C: UserMinus },
  "lock-outline": { C: Lock },
  "bell-outline": { C: Bell },
  translate: { C: Translate },
  "currency-eur": { C: CurrencyEur },
  "file-document-outline": { C: FileText },
  "shield-lock-outline": { C: ShieldCheck },
  "handshake-outline": { C: Handshake },
  "help-circle-outline": { C: Question },
  "cog-outline": { C: Gear },
  cog: { C: Gear, weight: "fill" },
  lifebuoy: { C: Lifebuoy },
  "lifebuoy-outline": { C: Lifebuoy },

  // form
  eye: { C: Eye },
  "eye-off": { C: EyeSlash },

  // misc / feedback
  star: { C: Star, weight: "fill" },
  "star-outline": { C: Star },
  plus: { C: Plus },
  minus: { C: Minus },
  check: { C: Check },
  "check-circle": { C: CheckCircle, weight: "fill" },
  "alert-circle": { C: WarningCircle, weight: "fill" },
  home: { C: House, weight: "fill" },
  "home-outline": { C: House },
  "view-grid": { C: SquaresFour, weight: "fill" },
  "view-grid-outline": { C: SquaresFour },
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  weight?: IconWeight;
}

/**
 * Phosphor-backed icon. Known names render the crisp Phosphor equivalent;
 * any unmapped name falls back to MaterialCommunityIcons so the swap is safe
 * to apply everywhere without leaving missing-icon gaps.
 */
export default function Icon({
  name,
  size = 22,
  color = COLORS.onSurface,
  weight,
}: IconProps) {
  const entry = MAP[name];
  if (entry) {
    const C = entry.C;
    return <C size={size} color={color} weight={weight ?? entry.weight ?? "regular"} />;
  }
  return <MaterialCommunityIcons name={name as never} size={size} color={color} />;
}
