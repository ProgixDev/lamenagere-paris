import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import Icon from "../ui/Icon";
import { BRAND, COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";

/**
 * "This is not your final kitchen."
 *
 * Asked for directly by the client: the 3D step is convincing enough that a
 * customer can take it for the kitchen they are buying, when all it does is
 * place the units. It arrives as a sheet from the bottom the first time the 3D
 * step opens, and leaves a chip on the canvas that brings it back — so the
 * caveat is unmissable once and reachable always, without a paragraph sitting
 * under the picture forever.
 */
export const INDICATIVE_SHORT = "Aperçu indicatif";

export const INDICATIVE_TITLE = "Ceci n'est pas votre cuisine définitive";

export const INDICATIVE_BODY =
  "Cet aperçu sert uniquement à préciser l'emplacement de vos meubles. " +
  "Les modèles et les finitions définitifs sont confirmés avec votre conseiller.";

/**
 * Text on the brand yellow is always navy.
 *
 * White on #FEC103 is 1.6:1 — unreadable, and the reason the palette documents
 * this pairing. Navy on the same yellow is 9.7:1.
 */
const ON_YELLOW = COLORS.primary;

/**
 * The chip that sits on the 3D canvas, and brings the sheet back.
 *
 * Small on purpose: it floats over a surface whose whole job is receiving
 * drags, so it takes as little of the canvas as it can while staying legible.
 */
export function IndicativeChip({ style, onPress }: { style?: any; onPress?: () => void }) {
  return (
    <TouchableOpacity
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${INDICATIVE_SHORT}. ${INDICATIVE_TITLE}. Toucher pour en savoir plus.`}
      hitSlop={6}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingLeft: 8,
          paddingRight: 10,
          height: 28,
          borderRadius: 999,
          backgroundColor: BRAND.yellow,
        },
        style,
      ]}
    >
      <Icon name="information-outline" size={14} color={ON_YELLOW} />
      <Text style={{ fontSize: 11.5, fontFamily: "Inter_600SemiBold", color: ON_YELLOW }}>
        {INDICATIVE_SHORT}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * The disclaimer, as a sheet that slides up from the bottom.
 *
 * `animationType="slide"` rather than a hand-rolled Reanimated transition: it
 * is what every other sheet in the app uses, and the native one keeps its
 * timing when the JS thread is busy — which, on the 3D step, it reliably is.
 */
export function IndicativeSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: BRAND.yellow,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: 34,
          }}
        >
          {/* Grabber, so the sheet reads as a sheet before anything is read. */}
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: "rgba(0,36,68,0.28)",
              marginBottom: 18,
            }}
          />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <Icon name="information-outline" size={22} color={ON_YELLOW} />
            <Text
              style={{
                flex: 1,
                fontSize: 21,
                lineHeight: 26,
                fontFamily: FONTS.serifBold,
                color: ON_YELLOW,
              }}
            >
              {INDICATIVE_TITLE}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              fontFamily: "Inter_400Regular",
              color: ON_YELLOW,
              opacity: 0.9,
            }}
          >
            {INDICATIVE_BODY}
          </Text>

          <TouchableOpacity
            onPress={() => {
              void Haptics.selectionAsync();
              onClose();
            }}
            accessibilityRole="button"
            style={{
              marginTop: 22,
              height: 50,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLORS.primary,
            }}
          >
            <Text
              style={{ fontSize: 14.5, fontFamily: "Inter_600SemiBold", color: COLORS.onPrimary }}
            >
              J'ai compris
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
