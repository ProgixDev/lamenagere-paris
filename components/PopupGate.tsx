import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePopups } from "../features/popups/hooks";
import { buildDeepLinkFromTarget, type CampaignTarget } from "../lib/notifications";
import type { AppPopup } from "../lib/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/** Deep-link target for a pop-up, or null when it isn't tappable. */
function targetForPopup(p: AppPopup): CampaignTarget | null {
  if (p.linkKind === "product" && p.linkProductId)
    return { kind: "product", id: p.linkProductId };
  if (p.linkKind === "category" && p.linkCategoryId)
    return { kind: "category", id: p.linkCategoryId };
  return null;
}

/**
 * Shows admin-managed marketing pop-ups when the app opens. Mounted once at the
 * root, it queues every active pop-up returned by GET /popups and displays them
 * one at a time — the user taps X (or the backdrop) to advance to the next.
 * Tapping the image follows its optional deep link and closes the pop-up.
 *
 * Pop-ups only appear inside the main app (tabs / main stack), never during
 * onboarding, auth or the animated splash. They re-appear on every cold launch
 * (nothing is persisted) — this component opens the queue once per mount.
 */
export default function PopupGate() {
  const { data: popups } = usePopups();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const openedRef = useRef(false);

  const seg = segments as string[];
  const inMainApp = seg[0] === "(tabs)" || seg[0] === "(main)";
  const list = popups ?? [];

  // Open the queue once, the first time we're in the main app with pop-ups to
  // show. openedRef keeps a later refetch from re-opening it in the same launch.
  useEffect(() => {
    if (openedRef.current) return;
    if (inMainApp && list.length > 0) {
      openedRef.current = true;
      setIndex(0);
    }
  }, [inMainApp, list.length]);

  const current = openedRef.current ? list[index] : undefined;
  const visible = !!current && inMainApp;

  function next() {
    setIndex((i) => i + 1);
  }

  function onPressImage() {
    if (!current) return;
    const target = targetForPopup(current);
    next();
    if (target) router.push(buildDeepLinkFromTarget(target) as never);
  }

  if (!visible || !current) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={next}
    >
      <View style={styles.backdrop}>
        {/* Tapping outside the image dismisses this pop-up. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={next} />

        <View style={styles.content} pointerEvents="box-none">
          <Pressable
            onPress={onPressImage}
            accessibilityRole="imagebutton"
            accessibilityLabel={current.title ?? "Annonce"}
          >
            <Image
              source={{ uri: current.imageUrl }}
              style={styles.image}
              contentFit="contain"
              transition={200}
            />
          </Pressable>

          <Pressable
            onPress={next}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={[styles.close, { top: insets.top + 12 }]}
          >
            <Ionicons name="close" size={22} color="#111" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: SCREEN_W * 0.86,
    height: SCREEN_H * 0.7,
    borderRadius: 16,
  },
  close: {
    position: "absolute",
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
});
