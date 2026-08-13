import React from "react";
import { View, Text } from "react-native";
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
    // Plain cart glyph — the same Phosphor icon the rest of the app uses, just
    // drawn large. A bespoke drawing here only made the screen look busier.
    case "cart":
      return <Icon name="shopping-outline" size={72} color={COLORS.onSurfaceVariant} />;
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
      {art ? (
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
