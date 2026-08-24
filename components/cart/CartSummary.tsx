import React from "react";
import { View, Text } from "react-native";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS, SHADOW } from "../../lib/typography";
import { formatPrice, formatPrice2 } from "../../lib/utils";
import { computeTotals, VAT_EXEMPTION_NOTE } from "../../lib/vat";

interface CartSummaryProps {
  /** Items total, HT — catalogue prices are stored and displayed excl. VAT. */
  subtotal: number;
  shipping?: number | null;
  discount?: number;
  /**
   * Delivery postal code, once known. It sets the VAT rate: 20 % métropole,
   * exempt overseas. Absent (cart tab, before checkout) the standard rate is
   * quoted, so the total can only go down once the address is entered.
   */
  postalCode?: string | null;
  /** Professional (B2B) accounts get the "prix professionnels" footnote. */
  isB2b?: boolean;
}

function Row({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: "Inter_400Regular",
          color: accent ? COLORS.secondary : COLORS.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: muted ? "Inter_400Regular" : "Inter_500Medium",
          color: accent ? COLORS.secondary : muted ? COLORS.outline : COLORS.onSurface,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function CartSummary({
  subtotal,
  shipping,
  discount = 0,
  postalCode,
  isB2b,
}: CartSummaryProps) {
  const totals = computeTotals({
    subtotalHt: subtotal,
    shippingHt: shipping ?? 0,
    discountHt: discount,
    postalCode,
  });
  const tvaPct = Math.round(totals.vatRate * 100);

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 16,
        padding: 18,
        ...SHADOW.card,
      }}
    >
      <Row label="Sous-total HT" value={formatPrice2(subtotal)} />

      {discount > 0 && (
        <Row label="Réduction" value={`−${formatPrice2(discount)}`} accent />
      )}

      <Row
        label="Livraison estimée"
        value={shipping != null ? (shipping === 0 ? "Gratuit" : formatPrice(shipping)) : "À déterminer"}
        muted
      />

      <Row
        label={totals.exempt ? "TVA" : `TVA (${tvaPct} %)`}
        value={totals.exempt ? "Non applicable" : formatPrice2(totals.vat)}
      />

      <View style={{ height: 1, backgroundColor: COLORS.outlineVariant, marginBottom: 12 }} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text
          style={{
            fontSize: 11,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            fontFamily: FONTS.bodySemibold,
            color: COLORS.onSurfaceVariant,
          }}
        >
          Total TTC
        </Text>
        <Text style={{ fontSize: 28, fontFamily: FONTS.serifBold, color: BRAND.blue }}>
          {formatPrice(totals.ttc)}
        </Text>
      </View>

      {totals.exempt ? (
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: COLORS.outline,
            marginTop: 8,
            lineHeight: 16,
          }}
        >
          {VAT_EXEMPTION_NOTE}
        </Text>
      ) : postalCode ? null : (
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: COLORS.outline,
            marginTop: 8,
          }}
        >
          TVA calculée à l'étape suivante selon votre adresse de livraison.
        </Text>
      )}

      {isB2b && (
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: COLORS.outline,
            marginTop: 8,
          }}
        >
          Prix professionnels affichés hors taxes.
        </Text>
      )}
    </View>
  );
}
