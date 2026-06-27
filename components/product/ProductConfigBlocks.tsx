import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import Icon from "../ui/Icon";
import Input from "../ui/Input";
import { COLORS } from "../../lib/constants";
import { formatPrice } from "../../lib/utils";
import type { ConfigBlock } from "../../lib/types";
import type { ConfigState } from "../../lib/config-blocks";
import { pickMessageMedia, uploadMessageMedia } from "../../features/messaging/upload";

interface Props {
  blocks: ConfigBlock[];
  value: ConfigState;
  onChange: (next: ConfigState) => void;
}

export default function ProductConfigBlocks({ blocks, value, onChange }: Props) {
  if (!blocks?.length) return null;
  const patch = (id: string, p: Partial<ConfigState[string]>) =>
    onChange({ ...value, [id]: { ...value[id], ...p } });

  return (
    <>
      {blocks.map((block) => (
        <Block key={block.id} title={block.label} required={block.required}>
          {block.type === "measurements" && (
            <MeasurementsBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
          )}
          {block.type === "shape" && (
            <ShapeBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
          )}
          {block.type === "colors" && (
            <ColorsBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
          )}
          {block.type === "accessories" && (
            <AccessoriesBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
          )}
          {block.type === "opening_details" && (
            <OpeningBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
          )}
          {block.type === "photos" && (
            <PhotosBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
          )}
        </Block>
      ))}
    </>
  );
}

type Sel = ConfigState[string] | undefined;
type Patch = (p: Partial<NonNullable<Sel>>) => void;

function Block({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 10 }}>
        {title}
        {required ? <Text style={{ color: COLORS.error }}> *</Text> : null}
      </Text>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>{children}</View>
    </View>
  );
}

function MeasurementsBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const fields = block.fields ?? [];
  return (
    <View style={{ gap: 12 }}>
      {fields.map((f) => (
        <Input
          key={f.key}
          label={f.label.toUpperCase()}
          value={sel?.measurements?.[f.key] ?? ""}
          onChangeText={(t) =>
            patch({ measurements: { ...(sel?.measurements ?? {}), [f.key]: t } })
          }
          keyboardType="numeric"
          suffix={f.unit ?? "cm"}
        />
      ))}
    </View>
  );
}

function Pill({ active, label, sub, onPress }: { active: boolean; label: string; sub?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 9999,
        backgroundColor: active ? COLORS.primary : "transparent",
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.outlineVariant,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium", color: active ? COLORS.onPrimary : COLORS.onSurface }}>
        {label}
        {sub ? ` ${sub}` : ""}
      </Text>
    </TouchableOpacity>
  );
}

function ShapeBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const options = block.options ?? [];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {options.map((o) => {
        const active = sel?.shapeKey === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => {
              Haptics.selectionAsync();
              patch({ shapeKey: o.key });
            }}
            style={{ width: 92, alignItems: "center" }}
          >
            <View
              style={{
                width: 92,
                height: 72,
                borderRadius: 10,
                borderWidth: active ? 2 : 1,
                borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                backgroundColor: COLORS.surfaceContainer,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {o.image ? (
                <Image source={{ uri: o.image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 22, fontFamily: "Manrope_800ExtraBold", color: COLORS.outline }}>{o.label}</Text>
              )}
            </View>
            <Text style={{ fontSize: 12, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium", color: active ? COLORS.primary : COLORS.onSurface, marginTop: 4 }}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ColorsBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const options = block.options ?? [];
  const selected = sel?.colorKeys ?? [];
  const toggle = (key: string) => {
    Haptics.selectionAsync();
    if (block.multiple) {
      patch({ colorKeys: selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key] });
    } else {
      patch({ colorKeys: selected.includes(key) ? [] : [key] });
    }
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {options.map((o) => {
        const active = selected.includes(o.key);
        return (
          <TouchableOpacity key={o.key} onPress={() => toggle(o.key)} style={{ alignItems: "center", width: 64 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: o.hex ?? COLORS.surfaceContainer,
                borderWidth: active ? 3 : 1,
                borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                overflow: "hidden",
              }}
            >
              {o.image ? <Image source={{ uri: o.image }} style={{ width: "100%", height: "100%" }} /> : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: COLORS.onSurface, marginTop: 4, textAlign: "center" }}>
              {o.label}
            </Text>
            {o.surchargeCents ? (
              <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>+{formatPrice(o.surchargeCents / 100)}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AccessoriesBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const items = block.items ?? [];
  const selected = sel?.accessoryIds ?? [];
  const toggle = (id: string) => {
    Haptics.selectionAsync();
    if (block.multiple === false) {
      patch({ accessoryIds: selected.includes(id) ? [] : [id] });
    } else {
      patch({ accessoryIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
    }
  };
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => {
        const active = selected.includes(it.id);
        return (
          <TouchableOpacity
            key={it.id}
            onPress={() => toggle(it.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: active ? COLORS.primary : COLORS.outlineVariant, backgroundColor: active ? `${COLORS.primary}0D` : "transparent" }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.surfaceContainer, overflow: "hidden" }}>
              {it.image ? <Image source={{ uri: it.image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>{it.title}</Text>
              {it.priceCents ? (
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>+{formatPrice(it.priceCents / 100)}</Text>
              ) : null}
            </View>
            <Icon name={active ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} size={22} color={active ? COLORS.primary : COLORS.outline} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function OpeningBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const options = block.options ?? [];
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const active = sel?.openingKey === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => {
              Haptics.selectionAsync();
              patch({ openingKey: o.key });
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: active ? COLORS.primary : COLORS.outlineVariant, backgroundColor: active ? `${COLORS.primary}0D` : "transparent" }}
          >
            {o.image ? (
              <Image source={{ uri: o.image }} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.surfaceContainer }} resizeMode="cover" />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>{o.label}</Text>
              {o.surchargeCents ? (
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>+{formatPrice(o.surchargeCents / 100)}</Text>
              ) : null}
            </View>
            <Icon name={active ? "radiobox-marked" : "radiobox-blank"} size={22} color={active ? COLORS.primary : COLORS.outline} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PhotosBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const [uploading, setUploading] = useState(false);
  const photos = sel?.photos ?? [];
  const add = async () => {
    if (uploading) return;
    const asset = await pickMessageMedia();
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadMessageMedia(asset);
      patch({ photos: [...photos, uploaded] });
    } catch {
      Alert.alert("Erreur", "L'envoi du fichier a échoué. Réessayez.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <View>
      {block.helpText ? (
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginBottom: 10 }}>{block.helpText}</Text>
      ) : null}
      {block.planImage ? (
        <Image source={{ uri: block.planImage }} style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 10, backgroundColor: COLORS.surfaceContainer }} resizeMode="contain" />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {photos.map((p, i) => (
          <View key={`${p.url}-${i}`} style={{ width: 64, height: 64 }}>
            {p.type === "video" ? (
              <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: COLORS.surfaceContainer, alignItems: "center", justifyContent: "center" }}>
                <Icon name="play-circle" size={26} color={COLORS.primary} />
              </View>
            ) : (
              <Image source={{ uri: p.url }} style={{ width: 64, height: 64, borderRadius: 10 }} resizeMode="cover" />
            )}
            <TouchableOpacity
              onPress={() => patch({ photos: photos.filter((_, idx) => idx !== i) })}
              hitSlop={6}
              style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.onSurface, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="close" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={add}
          disabled={uploading}
          style={{ width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderColor: COLORS.outlineVariant, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceContainerLow }}
        >
          {uploading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Icon name="camera-plus-outline" size={22} color={COLORS.outline} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}
