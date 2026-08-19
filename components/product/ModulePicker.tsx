import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import Icon from "../ui/Icon";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import { MODULES } from "../../lib/kitchen3d/catalog";
import type { KitchenModule, Slot } from "../../lib/kitchen3d/types";

/**
 * The library, as a sheet the customer can reach from the canvas.
 *
 * The horizontal strip of the same modules under the studio is fine while a
 * side is selected and someone is already thinking about that side — but it is
 * a strip: twenty units scrolled sideways, four visible, and only in move mode.
 * A customer who simply wants one more caisson should not have to find their way
 * into a mode first, which is what the floating button and this sheet are for.
 *
 * Grouped the way a kitchen is quoted — bas, colonnes, hauts — rather than in
 * catalogue order, so the list is scannable by the thing being looked for.
 */
const GROUPS: { slot: Slot; label: string; hint: string }[] = [
  { slot: "bas", label: "Meubles bas", hint: "Sous le plan de travail" },
  { slot: "colonne", label: "Colonnes", hint: "Du sol au plafond" },
  { slot: "haut", label: "Meubles hauts", hint: "Au mur" },
];

export function ModulePicker({
  visible,
  onClose,
  onPick,
  /**
   * Where each unit would land, by module id: a run number, or -1 for the open
   * floor. Said up front rather than discovered after pressing — the answer
   * changes what the customer expects to see, and a unit that quietly appears
   * in the middle of the room reads as a bug.
   */
  landing,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (module: KitchenModule) => void;
  landing: (moduleId: string) => number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        {/* Tapping the dimmed part closes it, which is what a sheet does. */}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            maxHeight: "78%",
            backgroundColor: COLORS.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 12,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: COLORS.outlineVariant,
              marginBottom: 14,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontFamily: FONTS.serifBold, color: COLORS.onSurface }}>
                Ajouter un meuble
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  color: COLORS.outline,
                  marginTop: 2,
                }}
              >
                Il se place tout seul ; vous pourrez le déplacer ensuite.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fermer" hitSlop={10}>
              <Icon name="close" size={22} color={COLORS.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 34 }}>
            {GROUPS.map((group) => {
              const items = MODULES.filter((m) => m.slot === group.slot);
              if (!items.length) return null;
              return (
                <View key={group.slot} style={{ marginBottom: 18 }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontFamily: "Inter_700Bold",
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: COLORS.outline,
                      marginBottom: 8,
                      marginLeft: 4,
                    }}
                  >
                    {group.label} · {group.hint}
                  </Text>
                  <View style={{ gap: 8 }}>
                    {items.map((m) => {
                      const run = landing(m.id);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            onPick(m);
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderRadius: 14,
                            backgroundColor: COLORS.surfaceContainerLowest,
                            borderWidth: 1,
                            borderColor: COLORS.outlineVariant,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 13.5,
                                fontFamily: "Inter_600SemiBold",
                                color: COLORS.onSurface,
                              }}
                            >
                              {m.label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontFamily: "Inter_400Regular",
                                color: COLORS.outline,
                                marginTop: 1,
                              }}
                            >
                              {m.widthMm} × {m.depthMm} mm ·{" "}
                              {run >= 0 ? `ira sur le mur ${run + 1}` : "se posera au sol"}
                            </Text>
                          </View>
                          <Icon name="plus" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
