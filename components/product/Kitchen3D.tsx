import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { MODULES } from "../../lib/kitchen3d/catalog";
import { RENDERER_HTML } from "../../lib/kitchen3d/renderer-html";
import type { KitchenScene } from "../../lib/kitchen3d/types";
import { COLORS } from "../../lib/constants";

/** Imperative camera controls, for buttons that sit outside the canvas. */
export interface Kitchen3DHandle {
  /** Factor under 1 moves closer, over 1 moves away. Clamped in the renderer. */
  zoom: (factor: number) => void;
}

/** One press of the + / − buttons. */
export const ZOOM_STEP = { in: 0.78, out: 1.28 } as const;

/**
 * The customer's kitchen, rendered in 3D.
 *
 * The scene arrives fully described from `buildScene`; this component only
 * carries it across to the WebView and hands back errors. Keeping the geometry
 * rules on the React Native side means the layout can be unit-tested and the
 * renderer swapped without the configure flow noticing.
 */
const Kitchen3D = forwardRef<
  Kitchen3DHandle,
  {
    scene: KitchenScene;
    /** Lets the customer tap a cabinet and slide it along its run. */
    editable?: boolean;
    selectedKey?: string | null;
    onSelect?: (key: string | null) => void;
    /** Fired on release with the dragged position — re-clamp before trusting it. */
    onMove?: (runIndex: number, key: string, offsetM: number) => void;
    /** The island moves in two axes, so it reports a point rather than an offset. */
    onMoveIlot?: (x: number, z: number) => void;
    style?: any;
    onError?: (message: string) => void;
  }
>(function Kitchen3D(
  {
    scene,
    editable = false,
    selectedKey = null,
    onSelect,
    onMove,
    onMoveIlot,
    style,
    onError,
  },
  handleRef,
) {
  const ref = useRef<WebView>(null);
  const [booted, setBooted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Serialised rather than passed by identity: the configure screen rebuilds
  // the scene every render, so comparing the payload by value is what stops an
  // unchanged kitchen being re-injected (and the camera being disturbed).
  const payload = useMemo(
    () => JSON.stringify({ ...scene, editable, catalog: MODULES }),
    [scene, editable],
  );

  const push = useCallback((js: string) => {
    ref.current?.injectJavaScript(`${js}; true;`);
  }, []);

  useEffect(() => {
    if (!booted) return;
    push(`window.__setScene(${JSON.stringify(payload)})`);
  }, [payload, booted, push]);

  useEffect(() => {
    if (!booted) return;
    push(`window.__setSelection(${JSON.stringify(selectedKey)})`);
  }, [selectedKey, booted, push]);

  useImperativeHandle(
    handleRef,
    () => ({
      // Dropped while the page is still loading rather than queued: a zoom the
      // customer asked for before anything was on screen is not worth replaying.
      zoom: (factor: number) => {
        if (booted) push(`window.__zoom(${Number(factor) || 1})`);
      },
    }),
    [booted, push],
  );

  const onMessage = useCallback(
    (e: any) => {
      let msg: any;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (msg.type === "boot") setBooted(true);
      if (msg.type === "select") onSelect?.(msg.key ?? null);
      if (msg.type === "moved" && typeof msg.offsetM === "number") {
        onMove?.(msg.runIndex, msg.key, msg.offsetM);
      }
      if (msg.type === "movedIlot" && typeof msg.x === "number" && typeof msg.z === "number") {
        onMoveIlot?.(msg.x, msg.z);
      }
      if (msg.type === "error") {
        setFailure(msg.message);
        onError?.(msg.message);
      }
    },
    [onError, onSelect, onMove, onMoveIlot],
  );

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={ref}
        source={{ html: RENDERER_HTML }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        // The scene handles its own gestures; the page itself must not move.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={styles.web}
      />
      {!booted && !failure && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
      {failure && (
        <View style={styles.overlay}>
          <Text style={styles.errTitle}>Aperçu 3D indisponible</Text>
          <Text style={styles.errBody}>{failure}</Text>
        </View>
      )}
    </View>
  );
});

export default Kitchen3D;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: "hidden", backgroundColor: "#EFEDE9" },
  web: { flex: 1, backgroundColor: "#EFEDE9" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEDE9",
    paddingHorizontal: 24,
  },
  errTitle: { fontSize: 15, fontWeight: "600", color: COLORS.onSurface, marginBottom: 6 },
  errBody: { fontSize: 13, color: COLORS.onSurfaceVariant, textAlign: "center" },
});
