import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import Icon from "./Icon";
import Button from "./Button";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS, TYPE } from "../../lib/typography";

/**
 * The illustrations. Drawn rather than shipped as images: the six
 * `assets/images/empty-*.png` slots are 70-byte placeholders that were never
 * filled, and vectors stay crisp at any size and follow the palette.
 */
export type EmptyArt = "cart" | "favorites" | "orders" | "messages" | "address" | "search";

/**
 * Motion designs, for the states worth animating. Delivered as looping GIFs
 * because expo-image plays those on both platforms, unlike the WebM the source
 * ships as, and this ffmpeg has no WebP encoder.
 *
 * The background is baked in (no alpha), so rather than hide it behind a disc
 * the asset is rebased to exactly COLORS.background (#FAFBFC) and drawn with no
 * container at all — it dissolves into the page. It is also cropped to its
 * content, which only filled 55% of the original canvas, off-centre.
 *
 * Two consequences for anyone replacing this file:
 *  - re-run the same rebase, or a faint square reappears wherever the asset's
 *    background differs from the page by even a level or two;
 *  - it is therefore tied to COLORS.background. Every screen that shows an
 *    animated empty state uses that colour today. If one ever needs it on a
 *    white surface, give the asset real alpha instead of rebasing it.
 */
const ANIMATED: Partial<Record<EmptyArt, number>> = {
  cart: require("../../assets/animations/empty-cart.gif"),
};

function Art({ kind }: { kind: EmptyArt }) {
  const ink = COLORS.outlineVariant;
  const accent = BRAND.blue;
  const common = {
    width: 132,
    height: 112,
    viewBox: "0 0 132 112",
    fill: "none" as const,
  };

  switch (kind) {
    case "cart":
      return (
        <Svg {...common}>
          <Path d="M26 26h14l12 46h48" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M46 40h58l-8 26H52" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={58} cy={88} r={6} stroke={ink} strokeWidth={3} />
          <Circle cx={94} cy={88} r={6} stroke={ink} strokeWidth={3} />
        </Svg>
      );
    case "favorites":
      return (
        <Svg {...common}>
          <Path
            d="M66 88S34 68 34 46a17 17 0 0 1 32-8 17 17 0 0 1 32 8c0 22-32 42-32 42Z"
            stroke={accent}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "orders":
      return (
        <Svg {...common}>
          <Rect x={34} y={30} width={64} height={56} rx={6} stroke={ink} strokeWidth={3} />
          <Path d="M34 46h64" stroke={ink} strokeWidth={3} />
          <Path d="M48 60h22M48 72h34" stroke={accent} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      );
    case "messages":
      return (
        <Svg {...common}>
          <Path
            d="M30 34h72v44H62l-16 14V78H30z"
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M46 50h40M46 62h26" stroke={accent} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      );
    case "address":
      return (
        <Svg {...common}>
          <Path
            d="M66 92s26-24 26-42a26 26 0 1 0-52 0c0 18 26 42 26 42Z"
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Circle cx={66} cy={48} r={9} stroke={accent} strokeWidth={3} />
        </Svg>
      );
    case "search":
      return (
        <Svg {...common}>
          <Circle cx={60} cy={50} r={22} stroke={ink} strokeWidth={3} />
          <Path d="M76 66l18 18" stroke={accent} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      );
  }
}

/**
 * The one empty state for the whole app.
 *
 * Six screens each hand-rolled their own version of a grey disc, a title and a
 * message — with diameters drifting between 56 and 80 px and only two of them
 * offering a way out. An empty screen without an action is a dead end, so the
 * action is part of the contract here.
 */
export default function EmptyState({
  art,
  icon,
  title,
  message,
  action,
  secondaryAction,
  compact = false,
}: {
  /** Drawn illustration. Preferred over `icon`. */
  art?: EmptyArt;
  /** Fallback glyph when no illustration fits. */
  icon?: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  /** Tighter spacing, for empty states inside a section rather than a screen. */
  compact?: boolean;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: compact ? 32 : 56,
        paddingHorizontal: 32,
      }}
    >
      {art && ANIMATED[art] ? (
        // No disc, no ring: the asset's own background is COLORS.background, so
        // it merges straight into the page. See the note on ANIMATED above.
        <Image
          source={ANIMATED[art]}
          // 112 is the art's true pixel count — the crop that survives from the
          // original 150px GIF. Drawn any larger it is visibly upscaled, so this
          // is the ceiling until a higher-resolution source exists.
          style={{ width: 112, height: 112 }}
          contentFit="contain"
          // expo-image plays animated sources on both platforms; React
          // Native's own Image only does so on iOS.
          autoplay
          accessibilityLabel=""
        />
      ) : art ? (
        <Art kind={art} />
      ) : icon ? (
        <Icon name={icon as never} size={48} color={COLORS.surfaceDim} />
      ) : null}

      <Text style={[TYPE.sectionTitle, { textAlign: "center", marginTop: 12 }]}>{title}</Text>

      {message && (
        <Text
          style={{
            fontSize: 13.5,
            lineHeight: 20,
            fontFamily: FONTS.body,
            color: COLORS.onSurfaceVariant,
            textAlign: "center",
            marginTop: 8,
            maxWidth: 300,
          }}
        >
          {message}
        </Text>
      )}

      {action && (
        <View style={{ marginTop: 22, alignSelf: "stretch", maxWidth: 320 }}>
          <Button label={action.label} onPress={action.onPress} size="lg" />
        </View>
      )}
      {secondaryAction && (
        <View style={{ marginTop: 10 }}>
          <Button
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant="secondary"
            size="md"
            fullWidth={false}
          />
        </View>
      )}
    </View>
  );
}
