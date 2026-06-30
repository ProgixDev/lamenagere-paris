import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import RangeSlider from "../ui/RangeSlider";
import { COLORS } from "../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../lib/typography";
import { formatPrice } from "../../lib/utils";
import {
  DEFAULT_FILTERS,
  type FilterState,
  type SortKey,
} from "../../features/products/filter-types";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "Populaire" },
  { value: "recent", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
];

const RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Toutes" },
  { value: 4, label: "4+" },
  { value: 3, label: "3+" },
  { value: 2, label: "2+" },
  { value: 1, label: "1+" },
];

function Chip({
  label,
  active,
  onPress,
  star,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  star?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 9999,
        backgroundColor: active ? COLORS.primary : COLORS.surfaceContainerLowest,
        ...SHADOW.soft,
      }}
    >
      {star && (
        <Icon name="star" size={13} color={active ? "#fff" : COLORS.primary} />
      )}
      <Text
        style={{
          fontSize: 13,
          fontFamily: active ? FONTS.bodySemibold : FONTS.bodyMedium,
          color: active ? COLORS.onPrimary : COLORS.onSurface,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.serif,
        fontSize: 20,
        lineHeight: 24,
        color: COLORS.onSurface,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  );
}

interface SortFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  priceBounds: { min: number; max: number };
  histogram?: number[];
  onApply: (next: FilterState) => void;
}

export default function SortFilterSheet({
  visible,
  onClose,
  value,
  priceBounds,
  histogram,
  onApply,
}: SortFilterSheetProps) {
  const [draft, setDraft] = useState<FilterState>(value);

  // Re-seed the draft each time the sheet is opened.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible]);

  const lo = draft.minPrice > 0 ? draft.minPrice : priceBounds.min;
  const hi = draft.maxPrice > 0 ? draft.maxPrice : priceBounds.max;

  const onPriceChange = (low: number, high: number) => {
    const atFull = low <= priceBounds.min && high >= priceBounds.max;
    setDraft((d) => ({
      ...d,
      minPrice: atFull ? 0 : low,
      maxPrice: atFull ? 0 : high,
    }));
  };

  const reset = () => setDraft(DEFAULT_FILTERS);

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Trier & filtrer">
      {/* Price Range */}
      {priceBounds.max > priceBounds.min && (
        <View style={{ marginBottom: 22 }}>
          <SectionLabel>Fourchette de prix</SectionLabel>
          <RangeSlider
            min={priceBounds.min}
            max={priceBounds.max}
            lowValue={lo}
            highValue={hi}
            step={Math.max(1, Math.round((priceBounds.max - priceBounds.min) / 100))}
            histogram={histogram}
            onChange={onPriceChange}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={[TYPE.price, { fontSize: 17 }]}>
              {formatPrice(lo)}
            </Text>
            <Text style={[TYPE.price, { fontSize: 17 }]}>
              {formatPrice(hi)}
            </Text>
          </View>
        </View>
      )}

      {/* Sort by */}
      <View style={{ marginBottom: 22 }}>
        <SectionLabel>Trier par</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={draft.sort === o.value}
              onPress={() => setDraft((d) => ({ ...d, sort: o.value }))}
            />
          ))}
        </View>
      </View>

      {/* Rating */}
      <View style={{ marginBottom: 24 }}>
        <SectionLabel>Note</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {RATING_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              star={o.value > 0}
              active={draft.minRating === o.value}
              onPress={() => setDraft((d) => ({ ...d, minRating: o.value }))}
            />
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button label="Réinitialiser" onPress={reset} variant="secondary" />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Appliquer" onPress={apply} />
        </View>
      </View>
    </Modal>
  );
}
