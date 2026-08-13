import React, { useEffect } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { COLORS, BRAND } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { formatDate, formatPrice } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import Skeleton from "../../../components/ui/Skeleton";
import { useCheckoutStore } from "../../../features/checkout/store";
import { useOrder } from "../../../features/orders/hooks";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const RING = 2 * Math.PI * 34;
const CHECK = 46;

/**
 * The ring and the tick draw themselves, in the brand blue.
 *
 * This screen is the single most emotional moment in the app and it used to be
 * a flat green disc — a colour that appears nowhere else in the brand — with no
 * motion at all.
 */
function SuccessMark() {
  const reduceMotion = useReducedMotion();
  const ring = useSharedValue(reduceMotion ? 0 : RING);
  const tick = useSharedValue(reduceMotion ? 0 : CHECK);

  useEffect(() => {
    if (reduceMotion) return;
    ring.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) });
    tick.value = withDelay(320, withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [ring, tick, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ring.value }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: tick.value }));

  return (
    <Svg width={96} height={96} viewBox="0 0 80 80">
      <Circle cx={40} cy={40} r={38} fill={`${BRAND.blue}14`} />
      <AnimatedCircle
        cx={40}
        cy={40}
        r={34}
        stroke={BRAND.blue}
        strokeWidth={3}
        fill="none"
        strokeDasharray={RING}
        animatedProps={ringProps}
        // Start the ring at the top rather than at three o'clock.
        transform="rotate(-90 40 40)"
      />
      <AnimatedPath
        d="M26 41l10 10 19-21"
        stroke={BRAND.blue}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={CHECK}
        animatedProps={tickProps}
      />
    </Svg>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline }}>{label}</Text>
      <Text
        style={{
          fontSize: strong ? 16 : 13,
          fontFamily: strong ? FONTS.serif : FONTS.bodyMedium,
          color: COLORS.onSurface,
          flexShrink: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function CheckoutConfirmationScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const lastOrderNumber = useCheckoutStore((s) => s.lastOrderNumber);
  const lastOrderId = useCheckoutStore((s) => s.lastOrderId);
  const reset = useCheckoutStore((s) => s.reset);

  // The real order, so the customer sees a receipt rather than a bare number.
  const { data: order, isLoading } = useOrder(lastOrderId ?? "");

  const goTo = (path: "/(main)/orders" | "/(tabs)", replace?: boolean) => {
    reset();
    if (replace) router.replace(path);
    else router.push(path);
  };

  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.delay(delay).springify().damping(16);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 32, paddingBottom: 48 }}>
        <View style={{ alignItems: "center" }}>
          <SuccessMark />
          <Animated.View entering={enter(240)} style={{ alignItems: "center" }}>
            <Text style={[TYPE.hero, { textAlign: "center", marginTop: 18 }]}>
              Commande confirmée
            </Text>
            <Text
              style={{
                fontSize: 14,
                lineHeight: 21,
                fontFamily: FONTS.body,
                color: COLORS.onSurfaceVariant,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Merci pour votre confiance.{"\n"}
              {lastOrderNumber ? `Commande ${lastOrderNumber}` : ""}
            </Text>
          </Animated.View>
        </View>

        {/* Receipt */}
        <Animated.View
          entering={enter(380)}
          style={{
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 20,
            padding: 18,
            marginTop: 26,
            ...SHADOW.card,
          }}
        >
          {isLoading && !order ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={16} width="55%" />
              <Skeleton height={64} borderRadius={12} />
              <Skeleton height={14} width="40%" />
            </View>
          ) : order ? (
            <>
              {order.items.map((item) => (
                <View
                  key={item.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}
                >
                  {item.product.images?.[0] ? (
                    <Image
                      source={{ uri: item.product.images[0] }}
                      style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: COLORS.surfaceContainer }}
                    />
                  ) : (
                    <View
                      style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: COLORS.surfaceContainer }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ fontSize: 13.5, fontFamily: FONTS.bodyMedium, color: COLORS.onSurface }}>
                      {item.product.name}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.outline, marginTop: 2 }}>
                      ×{item.quantity}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: FONTS.serif, color: COLORS.onSurface }}>
                    {formatPrice(item.price * item.quantity)}
                  </Text>
                </View>
              ))}

              <View style={{ height: 1, backgroundColor: COLORS.surfaceContainer, marginVertical: 8 }} />

              <Line label="Sous-total" value={formatPrice(order.subtotal)} />
              {order.discount ? (
                <Line
                  label={order.promoCode ? `Code ${order.promoCode}` : "Remise"}
                  value={`− ${formatPrice(order.discount)}`}
                />
              ) : null}
              <Line
                label="Livraison"
                value={order.shippingCost > 0 ? formatPrice(order.shippingCost) : "Offerte"}
              />
              <View style={{ height: 1, backgroundColor: COLORS.surfaceContainer, marginVertical: 8 }} />
              <Line label="Total payé" value={formatPrice(order.total)} strong />

              <View style={{ height: 1, backgroundColor: COLORS.surfaceContainer, marginVertical: 12 }} />

              <Line
                label="Livraison estimée"
                value={order.estimatedDelivery ? formatDate(new Date(order.estimatedDelivery)) : "à confirmer"}
              />
              <Line
                label="Adresse"
                value={`${order.shippingAddress.street}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}`}
              />
            </>
          ) : (
            <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline }}>
              {lastOrderNumber
                ? `Votre commande ${lastOrderNumber} a bien été enregistrée. Retrouvez son détail dans « Mes commandes ».`
                : "Votre commande a bien été enregistrée."}
              {"\n"}
              {formatDate(new Date())}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={enter(500)} style={{ marginTop: 24, gap: 12 }}>
          <Button label="Suivre ma commande" onPress={() => goTo("/(main)/orders")} size="lg" />
          <Button
            label="Continuer mes achats"
            onPress={() => goTo("/(tabs)", true)}
            variant="secondary"
            size="lg"
          />
        </Animated.View>

        <Text
          style={{
            fontSize: 12,
            fontFamily: FONTS.body,
            color: COLORS.outline,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          Un e-mail de confirmation a été envoyé à votre adresse.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
