import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import Icon from "../ui/Icon";
import Input from "../ui/Input";
import { COLORS } from "../../lib/constants";
import { formatPrice } from "../../lib/utils";
import type { ConfigBlock } from "../../lib/types";
import { ilotSurchargeCents, type ConfigState } from "../../lib/config-blocks";
import { SPACE } from "../../lib/typography";
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
          {block.type === "ilot" && (
            <IlotBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
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
          {block.type === "options" && (
            <OptionsBlock block={block} sel={value[block.id]} patch={(p) => patch(block.id, p)} />
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

/**
 * Two-column grid shared by every "pick from a list" block.
 *
 * Cards are 48% wide and the row is spread with `space-between`, so the gutter
 * is whatever the remaining 4% works out to. Percentages resolve against
 * whatever the block is rendered in, which keeps two columns at any container
 * width — a fixed `columnGap` plus fixed widths overflows into one column on
 * narrow screens. An odd last card sits on the left, as it should.
 */
function OptionGrid({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: SPACE.md,
      }}
    >
      {children}
    </View>
  );
}

/**
 * One tile: the photo does the talking, the label and surcharge sit under it.
 * `multiple` only decides how the choice is announced and which mark is drawn —
 * a tick for "take as many as you like", a dot for "pick one".
 */
function OptionCard({
  image,
  label,
  priceCents,
  active,
  multiple,
  onPress,
}: {
  image?: string;
  label: string;
  priceCents?: number;
  active: boolean;
  multiple: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: active }}
      accessibilityLabel={
        priceCents ? `${label}, + ${formatPrice(priceCents / 100)}` : label
      }
      style={{
        width: "48%",
        padding: SPACE.sm,
        borderRadius: 12,
        borderWidth: active ? 2 : 1,
        borderColor: active ? COLORS.primary : COLORS.outlineVariant,
        backgroundColor: active ? `${COLORS.primary}0D` : "transparent",
      }}
    >
      <View
        style={{
          width: "100%",
          aspectRatio: 1,
          borderRadius: 10,
          backgroundColor: COLORS.surfaceContainer,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {image ? (
          <>
            <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            <ImageZoomOverlay uri={image} />
          </>
        ) : (
          <Icon name="image-off-outline" size={22} color={COLORS.outline} />
        )}
      </View>

      {/* Sits over the photo's top corner so the mark reads at a glance down a
          column of tiles, instead of trailing each label at a different height.
          On its own disc, because a bare glyph disappears into whichever photo
          happens to be behind it. */}
      <View
        style={{
          position: "absolute",
          top: SPACE.md,
          right: SPACE.md,
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: "rgba(255,255,255,0.92)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={
            active
              ? multiple
                ? "checkbox-marked-circle"
                : "radiobox-marked"
              : multiple
                ? "checkbox-blank-circle-outline"
                : "radiobox-blank"
          }
          size={20}
          color={active ? COLORS.primary : COLORS.outline}
        />
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontSize: 13,
          lineHeight: 17,
          fontFamily: "Inter_600SemiBold",
          color: COLORS.onSurface,
          marginTop: SPACE.sm,
        }}
      >
        {label}
      </Text>
      {priceCents ? (
        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary, marginTop: 2 }}>
          +{formatPrice(priceCents / 100)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// Small "view fullscreen" badge + modal, meant to sit inside a relatively
// positioned image box. Tapping it never bubbles to the box's own onPress.
function ImageZoomOverlay({ uri }: { uri: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={6}
        style={{ position: "absolute", bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="fullscreen" size={12} color="#fff" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)", alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri }} style={{ width: "100%", height: "70%" }} resizeMode="contain" />
          <TouchableOpacity
            onPress={() => setOpen(false)}
            hitSlop={10}
            style={{ position: "absolute", top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

/**
 * The island: its own photo, its own measurements, its own price. When the
 * block isn't required the customer is asked whether they want one at all —
 * saying no hides the measurements and bills nothing.
 */
function IlotBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const fields = block.fields ?? [];
  const optional = !block.required;
  const included = optional ? sel?.ilotIncluded === true : true;

  const entered = fields
    .map((f) => {
      const raw = sel?.measurements?.[f.key];
      const value = raw != null && raw !== "" ? parseFloat(raw) : NaN;
      return Number.isFinite(value) ? { key: f.key, value } : null;
    })
    .filter((m): m is { key: string; value: number } => m != null);
  const cents = included ? ilotSurchargeCents(block, entered) : 0;

  return (
    <View style={{ gap: 12 }}>
      {block.planImage ? (
        <Image
          source={{ uri: block.planImage }}
          style={{ width: "100%", height: 150, borderRadius: 12, backgroundColor: COLORS.surfaceContainer }}
          resizeMode="cover"
        />
      ) : null}

      {optional && (
        <View style={{ alignItems: "center", paddingVertical: SPACE.sm }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: SPACE.md,
              width: "100%",
              maxWidth: 320,
            }}
          >
            {[
              { label: "Oui", value: true },
              { label: "Non", value: false },
            ].map((c) => {
              const active = sel?.ilotIncluded === c.value;
              return (
                <TouchableOpacity
                  key={c.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    patch({ ilotIncluded: c.value });
                  }}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    paddingVertical: SPACE.md,
                    paddingHorizontal: SPACE.md,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? COLORS.primary : COLORS.surfaceContainerLowest,
                    borderWidth: 1,
                    borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      textAlign: "center",
                      fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                      color: active ? COLORS.onPrimary : COLORS.onSurface,
                    }}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {included && (
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
          {cents > 0 && (
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>
              + {formatPrice(cents / 100)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * The three runs seen from above. Drawn rather than uploaded: there are only
 * ever three shapes, so a picture per product would be three identical files to
 * maintain. The back office draws the same paths in its block editor.
 */
const SHAPE_PATH: Record<string, string> = {
  i: "M26 8v30",
  l: "M14 8v30h24",
  u: "M12 8v30h28V8",
};

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
              {SHAPE_PATH[o.key] ? (
                <Svg width={62} height={46} viewBox="0 0 52 46" fill="none">
                  <Path
                    d={SHAPE_PATH[o.key]}
                    stroke={active ? COLORS.primary : COLORS.outline}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
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
    <OptionGrid>
      {items.map((it) => (
        <OptionCard
          key={it.id}
          image={it.image}
          label={it.title}
          priceCents={it.priceCents}
          active={selected.includes(it.id)}
          multiple={block.multiple !== false}
          onPress={() => toggle(it.id)}
        />
      ))}
    </OptionGrid>
  );
}

function OpeningBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const options = block.options ?? [];
  return (
    <OptionGrid>
      {options.map((o) => (
        <OptionCard
          key={o.key}
          image={o.image}
          label={o.label}
          priceCents={o.surchargeCents}
          active={sel?.openingKey === o.key}
          multiple={false}
          onPress={() => {
            Haptics.selectionAsync();
            patch({ openingKey: o.key });
          }}
        />
      ))}
    </OptionGrid>
  );
}

function OptionsBlock({ block, sel, patch }: { block: ConfigBlock; sel: Sel; patch: Patch }) {
  const options = block.options ?? [];
  const selected = sel?.optionKeys ?? [];
  const toggle = (key: string) => {
    Haptics.selectionAsync();
    if (block.multiple === false) {
      patch({ optionKeys: selected.includes(key) ? [] : [key] });
    } else {
      patch({ optionKeys: selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key] });
    }
  };
  return (
    <OptionGrid>
      {options.map((o) => (
        <OptionCard
          key={o.key}
          image={o.image}
          label={o.label}
          priceCents={o.surchargeCents}
          active={selected.includes(o.key)}
          multiple={block.multiple !== false}
          onPress={() => toggle(o.key)}
        />
      ))}
    </OptionGrid>
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
