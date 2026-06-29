import React from "react";
import { View, Text, Image } from "react-native";
import Icon from "../ui/Icon";
import { COLORS } from "../../lib/constants";
import { formatPrice } from "../../lib/utils";
import type { ConfigBlock } from "../../lib/types";

/**
 * Read-only showcase of a product's configurable options (colors, shapes,
 * accessories, opening details, made-to-measure). Purely to attract the
 * customer — the actual selection happens in the guided "Configurer" flow.
 */
export default function ProductOptionsPreview({ blocks }: { blocks: ConfigBlock[] }) {
  // Photos is an upload action, not an option to advertise.
  const shown = (blocks ?? []).filter((b) => b.type !== "photos");
  if (shown.length === 0) return null;

  return (
    <>
      {shown.map((block) => (
        <Block key={block.id} title={block.label}>
          {block.type === "measurements" && <MeasurementsPreview block={block} />}
          {block.type === "shape" && <ShapePreview block={block} />}
          {block.type === "colors" && <ColorsPreview block={block} />}
          {block.type === "accessories" && <AccessoriesPreview block={block} />}
          {block.type === "opening_details" && <OpeningPreview block={block} />}
        </Block>
      ))}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>{title}</Text>
        <View style={{ backgroundColor: `${COLORS.secondary}14`, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>AU CHOIX</Text>
        </View>
      </View>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>{children}</View>
    </View>
  );
}

function MeasurementsPreview({ block }: { block: ConfigBlock }) {
  const fields = block.fields ?? [];
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Icon name="ruler-square" size={16} color={COLORS.secondary} />
        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.outline }}>
          Fabriqué sur mesure
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {fields.map((f) => (
          <View key={f.key} style={{ backgroundColor: COLORS.surfaceContainerLow, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>
              {f.label}
              {f.unit ? ` (${f.unit})` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ShapePreview({ block }: { block: ConfigBlock }) {
  const options = block.options ?? [];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {options.map((o) => (
        <View key={o.key} style={{ width: 84, alignItems: "center" }}>
          <View style={{ width: 84, height: 64, borderRadius: 10, backgroundColor: COLORS.surfaceContainer, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {o.image ? (
              <Image source={{ uri: o.image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 24, fontFamily: "Manrope_800ExtraBold", color: COLORS.outline }}>{o.label}</Text>
            )}
          </View>
          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.onSurface, marginTop: 4 }}>{o.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ColorsPreview({ block }: { block: ConfigBlock }) {
  const options = block.options ?? [];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {options.map((o) => (
        <View key={o.key} style={{ alignItems: "center", width: 60 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: o.hex ?? COLORS.surfaceContainer, borderWidth: 1, borderColor: COLORS.outlineVariant, overflow: "hidden" }}>
            {o.image ? <Image source={{ uri: o.image }} style={{ width: "100%", height: "100%" }} /> : null}
          </View>
          <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: COLORS.onSurface, marginTop: 4, textAlign: "center" }}>
            {o.label}
          </Text>
          {o.surchargeCents ? (
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>+{formatPrice(o.surchargeCents / 100)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function AccessoriesPreview({ block }: { block: ConfigBlock }) {
  const items = block.items ?? [];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((it) => (
        <View key={it.id} style={{ width: 84 }}>
          <View style={{ width: 84, height: 84, borderRadius: 10, backgroundColor: COLORS.surfaceContainer, overflow: "hidden" }}>
            {it.image ? (
              <Image source={{ uri: it.image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Icon name="image-outline" size={22} color={COLORS.outline} />
              </View>
            )}
          </View>
          <Text numberOfLines={2} style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: COLORS.onSurface, marginTop: 4 }}>
            {it.title}
          </Text>
          {it.priceCents ? (
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>+{formatPrice(it.priceCents / 100)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function OpeningPreview({ block }: { block: ConfigBlock }) {
  const options = block.options ?? [];
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => (
        <View key={o.key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {o.image ? (
            <Image source={{ uri: o.image }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.surfaceContainer }} resizeMode="cover" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.surfaceContainer, alignItems: "center", justifyContent: "center" }}>
              <Icon name="door" size={20} color={COLORS.outline} />
            </View>
          )}
          <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>{o.label}</Text>
          {o.surchargeCents ? (
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>+{formatPrice(o.surchargeCents / 100)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
