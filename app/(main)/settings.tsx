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
import { FONTS, TYPE, SPACE, SHADOW } from "../../lib/typography";
import { PUSH_TOKEN_KEY } from "../../lib/storage";
import { registerForPushNotifications } from "../../lib/notifications";
import {
  registerDeviceApi,
  unregisterDeviceApi,
} from "../../features/notifications/api";
import { useNotifPrefStore } from "../../features/notifications/preference";
import { useAuthStore } from "../../features/auth/store";
import GuestGate from "../../components/GuestGate";
import { useIsGuestVisitor } from "../../features/auth/guards";

function SettingsScreenContent() {
  const router = useRouter();
  const notifications = useNotifPrefStore((s) => s.enabled);
  const setNotifEnabled = useNotifPrefStore((s) => s.setEnabled);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const logout = useAuthStore((s) => s.logout);

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

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est irréversible. Votre compte et vos données personnelles seront supprimés. Vos factures sont conservées de façon anonyme pendant la durée légale de conservation comptable.",
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Retour">
          <Icon name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={TYPE.screenTitle}>
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

        {/* Assistance — moved off the profile screen, which is now identity
            and activity only. */}
        <SettingsSection title="Assistance">
          <SettingsRow icon="lifebuoy" label="Signaler un problème" onPress={() => router.push("/(main)/support?mode=new")} />
          <SettingsRow icon="help-circle-outline" label="Aide & Contact" onPress={() => router.push("/(main)/support")} />
          <SettingsRow icon="information-outline" label="À propos" onPress={() => router.push("/(main)/about")} last />
        </SettingsSection>

        {/* Legal */}
        <SettingsSection title="Légal">
          <SettingsRow icon="file-document-outline" label="Conditions générales" onPress={() => router.push("/(main)/legal/terms")} />
          <SettingsRow icon="shield-lock-outline" label="Politique de confidentialité" onPress={() => router.push("/(main)/legal/privacy")} />
          <SettingsRow icon="handshake-outline" label="CGV" onPress={() => router.push("/(main)/legal/cgv")} last />
        </SettingsSection>

        {/* Session, then the irreversible action — kept in separate cards so
            "Supprimer" is never a mis-tap away from "Se déconnecter". The old
            washed-out red fill is gone; the red now lives in the label. */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACE.sm, gap: 12 }}>
          <ActionCard
            icon="logout"
            label="Se déconnecter"
            color={COLORS.onSurface}
            onPress={handleLogout}
          />
          <ActionCard
            icon="account-remove-outline"
            label="Supprimer mon compte"
            color={COLORS.error}
            onPress={handleDeleteAccount}
          />
        </View>

        <Text
          style={{
            fontSize: 11,
            fontFamily: FONTS.body,
            color: COLORS.surfaceDim,
            textAlign: "center",
            marginTop: SPACE.xl,
          }}
        >
          La Ménagère Paris — v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: SPACE.xl }}>
      <Text style={[TYPE.overline, { paddingHorizontal: 20, marginBottom: SPACE.md }]}>
        {title}
      </Text>
      <View style={{ marginHorizontal: 20, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, overflow: "hidden", ...SHADOW.card }}>
        {children}
      </View>
    </View>
  );
}

/** Standalone account action — its own card, so it reads apart from the lists. */
function ActionCard({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 15,
        paddingHorizontal: 16,
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 16,
        ...SHADOW.soft,
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <Text style={{ fontSize: 15, fontFamily: FONTS.bodyMedium, color }}>
        {label}
      </Text>
    </TouchableOpacity>
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
        paddingVertical: 15,
        gap: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLORS.outlineVariant,
      }}
    >
      <Icon name={icon as any} size={20} color={COLORS.primary} />
      <Text style={{ flex: 1, fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.onSurface }}>
        {label}
      </Text>
      {value && (
        <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline, marginRight: 4 }}>
          {value}
        </Text>
      )}
      {rightComponent || (onPress && <Icon name="chevron-right" size={18} color={COLORS.surfaceDim} />)}
    </TouchableOpacity>
  );
}

/**
 * Guests may browse the catalogue freely, but this screen holds personal
 * account data — show the sign-in prompt instead of firing authenticated
 * requests that would fail.
 */
export default function SettingsScreen() {
  const isGuestVisitor = useIsGuestVisitor();
  if (isGuestVisitor) {
    return (
      <GuestGate
        icon="cog-outline"
        title="Vos réglages"
        message="Connectez-vous pour gérer vos préférences, vos notifications et votre compte."
      />
    );
  }
  return <SettingsScreenContent />;
}
