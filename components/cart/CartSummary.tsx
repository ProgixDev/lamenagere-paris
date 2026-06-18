import React from "react";
import { View, Text } from "react-native";
import { COLORS, TVA_RATE } from "../../lib/constants";
import { formatPrice, formatPrice2, splitTtc } from "../../lib/utils";

interface CartSummaryProps {
  subtotal: number;
  shipping?: number | null;
  total: number;
  /** Professional (B2B) accounts see an HT / TVA / TTC breakdown. */
  isB2b?: boolean;
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: muted ? "Inter_400Regular" : "Inter_500Medium",
          color: muted ? COLORS.outline : COLORS.onSurface,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function CartSummary({ subtotal, shipping, total, isB2b }: CartSummaryProps) {
  const tvaPct = Math.round(TVA_RATE * 100);
  const { ht, tva } = splitTtc(subtotal, TVA_RATE);

  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        padding: 16,
      }}
    >
      {isB2b ? (
        <>
          {/* B2B: show the VAT breakdown on the items subtotal. */}
          <Row label="Sous-total HT" value={formatPrice2(ht)} />
          <Row label={`TVA (${tvaPct}%)`} value={formatPrice2(tva)} />
        </>
      ) : (
        <Row label="Sous-total" value={formatPrice(subtotal)} />
      )}

      <Row
        label="Livraison estimée"
        value={shipping != null ? formatPrice(shipping) : "À déterminer"}
        muted
      />

      <View style={{ height: 1, backgroundColor: "#f0f0f0", marginBottom: 12 }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.primary }}>
          {isB2b ? "Total TTC" : "Total"}
        </Text>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.secondary }}>
          {formatPrice(total)}
        </Text>
      </View>

      {isB2b && (
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: COLORS.outline,
            marginTop: 8,
          }}
        >
          Prix professionnels — TVA {tvaPct}% incluse.
        </Text>
      )}
    </View>
  );
}
