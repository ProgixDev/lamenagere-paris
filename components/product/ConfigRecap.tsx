import React from "react";
import { View, Text } from "react-native";
import { COLORS } from "../../lib/constants";
import { formatPrice } from "../../lib/utils";
import { configRecapRows } from "../../lib/config-blocks";
import type { ItemConfiguration } from "../../lib/types";

/**
 * The configuration of an ordered line, read back block by block.
 *
 * Orders used to show it as one grey `summarizeConfiguration()` line clipped to
 * two rows, so most of what the customer had chosen was simply not visible.
 * Here each block gets its own line, measurements are indented under the block
 * that asked for them, and anything that cost extra shows its price.
 */
export default function ConfigRecap({
  configuration,
}: {
  configuration?: ItemConfiguration | null;
}) {
  const rows = configRecapRows(configuration);
  if (!rows.length) return null;

  return (
    <View
      style={{
        marginTop: 10,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        paddingVertical: 4,
      }}
    >
      {rows.map((r, i) => (
        <View
          key={`${r.label}-${i}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 12,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: r.sub ? 12 : 12.5,
              fontFamily: r.sub ? "Inter_400Regular" : "Inter_600SemiBold",
              color: r.sub ? COLORS.outline : COLORS.onSurface,
              paddingLeft: r.sub ? 12 : 0,
            }}
          >
            {r.label}
          </Text>
          {r.value ? (
            <Text
              style={{
                flex: 1.2,
                fontSize: 12.5,
                fontFamily: "Inter_500Medium",
                color: COLORS.onSurfaceVariant,
                textAlign: "right",
              }}
            >
              {r.value}
            </Text>
          ) : null}
          {r.priceCents ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_600SemiBold",
                color: COLORS.secondary,
                minWidth: 56,
                textAlign: "right",
              }}
            >
              + {formatPrice(r.priceCents / 100)}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
