import React, { useCallback, useEffect, useRef } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import { COLORS } from "../lib/constants";
import { FONTS, SPACE, TYPE } from "../lib/typography";
import { useAppVersionGate } from "../features/app-version/hooks";
import {
  FALLBACK_STORE_URL,
  INSTALLED_APP_VERSION,
} from "../features/app-version/api";

const DEFAULT_UPDATE_MESSAGE =
  "Cette version de l’application n’est plus prise en charge. Installez la dernière version depuis le store pour continuer à l’utiliser en toute sécurité.";

const MAINTENANCE_MESSAGE =
  "L’application est momentanément en maintenance. Nous revenons très vite — merci de votre patience.";

/**
 * Écran bloquant « Mise à jour requise ».
 *
 * Monté à la racine, au-dessus de tout le reste (auth, onboarding, splash) :
 * une version dont on veut couper l'accès — typiquement parce qu'une faille a
 * été corrigée dans la suivante — ne doit rien laisser faire, pas même naviguer
 * en invité.
 *
 * Le verrou est piloté par le back-office (`/admin/settings`) : l'admin relève
 * la version minimale par plateforme une fois la nouvelle version réellement
 * disponible sur le store. Rien n'est détecté automatiquement — une version
 * publiée n'est pas installable immédiatement par tout le monde (revue App
 * Store, déploiement progressif Play), et un verrou anticipé enfermerait des
 * utilisateurs sans issue.
 *
 * Ne bloque JAMAIS en cas de doute : requête en échec, hors ligne ou version
 * illisible laissent l'app passer normalement (voir `useAppVersionGate`).
 */
export default function UpdateGate() {
  const { data, refetch } = useAppVersionGate();
  const appState = useRef(AppState.currentState);

  // Re-vérifie au retour au premier plan : l'utilisateur qui revient du store,
  // et la session restée ouverte pendant qu'on relève la version minimale.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        refetch();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refetch]);

  const openStore = useCallback(() => {
    const url = data?.storeUrl || FALLBACK_STORE_URL;
    Linking.openURL(url).catch(() => {
      // Store indisponible (URL mal saisie, appareil sans store) : on laisse
      // l'écran en place, l'utilisateur peut réessayer.
    });
  }, [data?.storeUrl]);

  const mustUpdate = !!data?.updateRequired;
  const inMaintenance = !mustUpdate && !!data?.maintenanceMode;
  if (!mustUpdate && !inMaintenance) return null;

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      // Volontairement vide : le retour matériel Android ne doit pas fermer le
      // verrou.
      onRequestClose={() => {}}
    >
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <Animated.View
          entering={FadeIn.duration(320)}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: COLORS.surfaceContainer,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: SPACE.xl,
            }}
          >
            <Icon
              name={mustUpdate ? "shield-check-outline" : "wrench-outline"}
              size={38}
              color={COLORS.primary}
            />
          </View>

          <Text style={[TYPE.sectionTitle, { textAlign: "center", marginBottom: SPACE.sm }]}>
            {mustUpdate ? "Mise à jour requise" : "Maintenance en cours"}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontFamily: FONTS.body,
              color: COLORS.onSurfaceVariant,
              textAlign: "center",
              lineHeight: 20,
              marginBottom: SPACE.xl,
            }}
          >
            {mustUpdate
              ? data?.message || DEFAULT_UPDATE_MESSAGE
              : data?.message || MAINTENANCE_MESSAGE}
          </Text>

          {mustUpdate && (
            <View style={{ width: "100%", gap: SPACE.md }}>
              <Button label="METTRE À JOUR" onPress={openStore} size="md" />
              <Pressable onPress={() => refetch()} hitSlop={10}>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: FONTS.bodyMedium,
                    color: COLORS.outline,
                    textAlign: "center",
                  }}
                >
                  J’ai déjà mis à jour
                </Text>
              </Pressable>
            </View>
          )}

          {inMaintenance && (
            <View style={{ width: "100%" }}>
              <Button
                label="RÉESSAYER"
                variant="secondary"
                onPress={() => refetch()}
                size="md"
              />
            </View>
          )}

          {mustUpdate && (
            <Text
              style={{
                position: "absolute",
                bottom: SPACE.xl,
                fontSize: 11,
                fontFamily: FONTS.body,
                color: COLORS.outline,
              }}
            >
              Version {INSTALLED_APP_VERSION ?? "?"}
              {data?.minVersion ? ` · requise ${data.minVersion}` : ""}
            </Text>
          )}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}
