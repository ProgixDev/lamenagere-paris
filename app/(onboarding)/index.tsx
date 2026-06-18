import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { PRODUCT_IMAGES } from "../../lib/mock-data";
import { useOnboardingStore } from "../../features/onboarding/store";

const { width: W, height: H } = Dimensions.get("window");

type Slide = {
  image: any;
  eyebrow: string;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    image: PRODUCT_IMAGES.cuisineNoireOr,
    eyebrow: "Bienvenue à La Ménagère Paris",
    title: "L'art du sur-mesure,\nlivré chez vous.",
    subtitle:
      "Cuisines, chambres, portes et baies vitrées de haute facture. Une signature française, à la maison.",
  },
  {
    image: PRODUCT_IMAGES.chambreRoyale,
    eyebrow: "Une exigence haut de gamme",
    title: "Sur mesure\nou prêt-à-installer.",
    subtitle:
      "Configurez vos dimensions, demandez un devis, ou commandez en quelques tapotements.",
  },
  {
    image: PRODUCT_IMAGES.portePivotante,
    eyebrow: "Partout en France",
    title: "Métropole, DOM-TOM,\nsuivi en temps réel.",
    subtitle:
      "De la Réunion à Mayotte, vos commandes voyagent avec soin et dans les délais.",
  },
];

const AUTO_MS = 5000;
const FADE_MS = 700;

export default function OnboardingIntro() {
  const router = useRouter();
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const [active, setActive] = useState(0);
  // `displayed` lags `active` so the old text can fade out before the new
  // text fades in (the background images crossfade on `active` directly).
  const [displayed, setDisplayed] = useState(0);

  const opacities = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentShift = useRef(new Animated.Value(0)).current;

  // Animate to active slide
  useEffect(() => {
    Animated.parallel(
      opacities.map((op, i) =>
        Animated.timing(op, {
          toValue: i === active ? 1 : 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [active, opacities]);

  // Crossfade the text block: fade/slide out the old slide, swap content,
  // then fade/slide the new slide in.
  useEffect(() => {
    if (displayed === active) return;
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(contentShift, {
        toValue: 14,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDisplayed(active);
      contentShift.setValue(-10);
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(contentShift, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [active, displayed, contentOpacity, contentShift]);

  // Auto-advance
  useEffect(() => {
    const t = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, []);

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markSeen();
    router.replace("/(auth)/login");
  };

  const next = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (active < SLIDES.length - 1) {
      setActive(active + 1);
    } else {
      finish();
    }
  };

  const isLast = active === SLIDES.length - 1;
  const slide = SLIDES[displayed];

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />

      {/* ── Crossfading background images ───────────────── */}
      {SLIDES.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            ...StyleAbsoluteFill,
            opacity: opacities[i],
          }}
          pointerEvents="none"
        >
          <Image
            source={s.image}
            style={{ width: W, height: H }}
            resizeMode="cover"
          />
        </Animated.View>
      ))}

      {/* ── Gradient overlay for legibility ─────────────── */}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.55)",
          "rgba(0,0,0,0.10)",
          "rgba(0,0,0,0.20)",
          "rgba(0,12,26,0.85)",
          "rgba(0,12,26,0.96)",
        ]}
        locations={[0, 0.25, 0.55, 0.85, 1]}
        style={StyleAbsoluteFill}
        pointerEvents="none"
      />

      {/* ── Content ─────────────────────────────────────── */}
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <View style={{ width: 64 }} />
          <Image
            source={require("../../assets/images/logo.png")}
            style={{ width: 188, height: 57, resizeMode: "contain" }}
          />
          {!isLast ? (
            <TouchableOpacity
              onPress={finish}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 9999,
                backgroundColor: "rgba(255,255,255,0.18)",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color: "#fff",
                }}
              >
                Passer
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>

        {/* Bottom content */}
        <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 24, paddingBottom: 16 }}>
          {/* Animated text block (fades + slides between slides) */}
          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentShift }],
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_600SemiBold",
                color: COLORS.secondaryContainer,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {slide.eyebrow}
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontFamily: "Manrope_800ExtraBold",
                color: "#fff",
                lineHeight: 38,
                marginBottom: 14,
              }}
            >
              {slide.title}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: "rgba(255,255,255,0.85)",
                lineHeight: 22,
                marginBottom: 26,
              }}
            >
              {slide.subtitle}
            </Text>
          </Animated.View>

          {/* Pagination dots */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setActive(i)}
                hitSlop={8}
                style={{
                  width: i === active ? 28 : 8,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i === active ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={next}
            activeOpacity={0.9}
            style={{
              paddingVertical: 16,
              borderRadius: 9999,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_700Bold",
                color: COLORS.primary,
                letterSpacing: 1.5,
              }}
            >
              {isLast ? "COMMENCER" : "SUIVANT"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={finish} style={{ alignItems: "center", marginTop: 14 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              J'ai déjà un compte
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const StyleAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
