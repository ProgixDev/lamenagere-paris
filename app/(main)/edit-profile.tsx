import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "../../components/ui/Icon";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { useAuthStore } from "../../features/auth/store";
import type { AccountType } from "../../lib/types";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, isLoading, clearError } = useAuthStore();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [accountType, setAccountType] = useState<AccountType>(
    user?.accountType ?? "particulier",
  );
  const [company, setCompany] = useState(user?.company ?? "");
  const [siret, setSiret] = useState(user?.siret ?? "");
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as "error" | "success",
  });

  const isPro = accountType === "professionnel";

  const validate = () => {
    const errs: Record<string, string> = {};
    if (fullName.trim().length === 0) errs.fullName = "Nom complet requis";
    if (isPro && company.trim().length === 0)
      errs.company = "Nom de l'entreprise requis";
    if (isPro && !/^\d{14}$/.test(siret.replace(/\s/g, "")))
      errs.siret = "SIRET invalide (14 chiffres)";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await updateProfile({
        fullName: fullName.trim(),
        accountType,
        phone: phone.trim() || undefined,
        company: isPro ? company.trim() : undefined,
        siret: isPro ? siret.replace(/\s/g, "") : undefined,
      });
      setToast({ visible: true, message: "Profil mis à jour", type: "success" });
      setTimeout(() => router.back(), 600);
    } catch (e) {
      // Read the message off the thrown error — the `error` value captured from
      // the store at render time is stale here and would mask the real cause.
      const msg =
        (e as { message?: string })?.message || "Mise à jour impossible";
      setToast({ visible: true, message: msg, type: "error" });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Icon
              name="chevron-left"
              size={26}
              color={COLORS.onSurface}
            />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Manrope_700Bold",
              color: COLORS.onSurface,
            }}
          >
            Modifier le profil
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 20, marginTop: 8 }}>
            <Input
              label="NOM COMPLET"
              placeholder="Marie Dupont"
              value={fullName}
              onChangeText={setFullName}
              error={fieldError.fullName}
              autoCapitalize="words"
            />

            <Input
              label="EMAIL"
              value={user?.email ?? ""}
              onChangeText={() => {}}
              disabled
            />

            <Input
              label="TÉLÉPHONE (OPTIONNEL)"
              placeholder="+33 6 00 00 00 00"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <View>
              <Text
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontFamily: "Inter_600SemiBold",
                  color: COLORS.outline,
                  marginBottom: 8,
                }}
              >
                TYPE DE COMPTE
              </Text>
              <View style={{ flexDirection: "row", gap: 14 }}>
                {(["particulier", "professionnel"] as AccountType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setAccountType(type)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 9999,
                      alignItems: "center",
                      backgroundColor:
                        accountType === type ? COLORS.primary : "transparent",
                      borderWidth: accountType === type ? 0 : 1,
                      borderColor: `${COLORS.outlineVariant}33`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: "Inter_600SemiBold",
                        textTransform: "uppercase",
                        color:
                          accountType === type ? COLORS.onPrimary : COLORS.onSurface,
                      }}
                    >
                      {type === "particulier" ? "PARTICULIER" : "PROFESSIONNEL"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {isPro && (
              <>
                <Input
                  label="NOM DE L'ENTREPRISE"
                  value={company}
                  onChangeText={setCompany}
                  error={fieldError.company}
                  autoCapitalize="words"
                />
                <Input
                  label="SIRET"
                  placeholder="14 chiffres"
                  value={siret}
                  onChangeText={setSiret}
                  error={fieldError.siret}
                  keyboardType="number-pad"
                />
              </>
            )}

            <Button
              label="ENREGISTRER"
              onPress={handleSave}
              loading={isLoading}
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => {
          setToast((prev) => ({ ...prev, visible: false }));
          clearError();
        }}
      />
    </SafeAreaView>
  );
}
