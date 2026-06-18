import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "../../components/ui/Icon";
import * as SecureStore from "expo-secure-store";
import { COLORS } from "../../lib/constants";
import { PUSH_TOKEN_KEY } from "../../lib/storage";
import { registerForPushNotifications } from "../../lib/notifications";
import {
  registerDeviceApi,
  unregisterDeviceApi,
} from "../../features/notifications/api";
import { useNotifPrefStore } from "../../features/notifications/preference";
import { useAuthStore } from "../../features/auth/store";

export default function SettingsScreen() {
  const router = useRouter();
  const notifications = useNotifPrefStore((s) => s.enabled);
  const setNotifEnabled = useNotifPrefStore((s) => s.setEnabled);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  // Toggling actually (un)registers this device for push on the server.
  const handleNotifToggle = async (value: boolean) => {
    setNotifEnabled(value);
    try {
      if (value) {
        const token = await registerForPushNotifications();
        if (token) {
          await registerDeviceApi(token);
          await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
        }
      } else {
        const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
        if (token) await unregisterDeviceApi(token);
      }
    } catch {
      // best-effort; preference is still saved locally
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est irréversible. Toutes vos données seront supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              // AuthGate redirects to login once the session is cleared.
            } catch (e) {
              const msg =
                (e as { response?: { data?: { message?: string } } })?.response
                  ?.data?.message ?? "Suppression impossible";
              Alert.alert("Erreur", msg);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Paramètres
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Account */}
        <SettingsSection title="Compte">
          <SettingsRow icon="account-outline" label="Modifier mon profil" onPress={() => router.push("/(main)/edit-profile")} />
          <SettingsRow icon="lock-outline" label="Modifier mon mot de passe" onPress={() => router.push("/(main)/change-password")} />
          <SettingsRow icon="bell-outline" label="Notifications" rightComponent={
            <Switch value={notifications} onValueChange={handleNotifToggle} trackColor={{ true: COLORS.primary, false: "#e0e0e0" }} />
          } last />
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection title="Préférences">
          <SettingsRow icon="translate" label="Langue" value="Français" />
          <SettingsRow icon="currency-eur" label="Devise" value="EUR (€)" last />
        </SettingsSection>

        {/* Legal */}
        <SettingsSection title="Légal">
          <SettingsRow icon="file-document-outline" label="Conditions générales" onPress={() => router.push("/(main)/legal/terms")} />
          <SettingsRow icon="shield-lock-outline" label="Politique de confidentialité" onPress={() => router.push("/(main)/legal/privacy")} />
          <SettingsRow icon="handshake-outline" label="CGV" onPress={() => router.push("/(main)/legal/cgv")} last />
        </SettingsSection>

        {/* Danger */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: "#fff5f5",
              borderRadius: 14,
            }}
          >
            <Icon name="account-remove-outline" size={20} color="#dc3545" />
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#dc3545" }}>
              Supprimer mon compte
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: COLORS.outline, textTransform: "uppercase", letterSpacing: 2, paddingHorizontal: 20, marginBottom: 8 }}>
        {title}
      </Text>
      <View style={{ marginHorizontal: 20, backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ icon, label, value, onPress, rightComponent, last = false }: {
  icon: string; label: string; value?: string; onPress?: () => void; rightComponent?: React.ReactNode; last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightComponent}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#f5f5f5",
      }}
    >
      <Icon name={icon as any} size={20} color={COLORS.primary} />
      <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>
        {label}
      </Text>
      {value && (
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, marginRight: 4 }}>
          {value}
        </Text>
      )}
      {rightComponent || (onPress && <Icon name="chevron-right" size={18} color={COLORS.surfaceDim} />)}
    </TouchableOpacity>
  );
}
