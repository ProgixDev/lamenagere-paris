import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import Input from "../../components/ui/Input";
import PhoneInput from "../../components/ui/PhoneInput";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { useAuthStore } from "../../features/auth/store";
import {
  combinePhone,
  isValidLocalNumber,
  DEFAULT_PHONE_COUNTRY,
} from "../../lib/phone";
import type { AccountType } from "../../lib/types";

/**
 * Post-OAuth onboarding. Google sign-in gives us an email (and sometimes a
 * name) but never the account type or phone, so we collect them here before
 * letting the user into the app. Completing this flips `onboarded` to true.
 */
export default function CompleteProfileScreen() {
  const { user, completeProfile, isLoading, error, clearError, logout } =
    useAuthStore();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [accountType, setAccountType] = useState<AccountType>(
    user?.accountType ?? "particulier",
  );
  const [company, setCompany] = useState(user?.company ?? "");
  const [siret, setSiret] = useState(user?.siret ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [phoneCountry, setPhoneCountry] = useState<string>(DEFAULT_PHONE_COUNTRY);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ visible: false, message: "", type: "error" as const });

  const isPro = accountType === "professionnel";

  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (fullName.trim().length === 0) errs.fullName = "Nom complet requis";
    if (isPro && company.trim().length === 0) errs.company = "Nom de l'entreprise requis";
    if (isPro && !/^\d{14}$/.test(siret.replace(/\s/g, "")))
      errs.siret = "SIRET invalide (14 chiffres)";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = async () => {
    if (!validateStep1()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(1);
  };

  const finish = async () => {
    if (!isValidLocalNumber(phone)) {
      setFieldError({ phone: "Téléphone requis" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await completeProfile({
        fullName: fullName.trim(),
        accountType,
        phone: combinePhone(phoneCountry, phone),
        company: isPro ? company.trim() : undefined,
        siret: isPro ? siret.replace(/\s/g, "") : undefined,
      });
      // AuthGate redirects to the tabs once `onboarded` becomes true.
    } catch {
      setToast({
        visible: true,
        message: error || "Impossible d’enregistrer votre profil",
        type: "error",
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header: logo + sign out */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <View style={{ width: 24 }} />
          <Image
            source={require("../../assets/images/logo.png")}
            style={{ width: 132, height: 40, resizeMode: "contain" }}
          />
          <TouchableOpacity onPress={() => logout()} hitSlop={8}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.outline} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View className="flex-row gap-2 px-6 mb-6">
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? COLORS.primary : COLORS.outlineVariant,
              }}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 mb-1">
            <Text
              className="text-xs uppercase tracking-widest"
              style={{ color: COLORS.secondary, fontFamily: "Inter_600SemiBold" }}
            >
              {step === 0 ? "BIENVENUE" : "PRESQUE FINI"}
            </Text>
          </View>
          <View className="px-6 mb-1">
            <Text
              className="text-3xl"
              style={{ color: COLORS.primaryContainer, fontFamily: "Manrope_700Bold" }}
            >
              {step === 0 ? "Complétons votre profil" : "Un dernier détail"}
            </Text>
          </View>
          <View className="px-6 mb-8">
            <Text className="text-sm" style={{ color: COLORS.outline }}>
              {step === 0
                ? "Quelques informations pour personnaliser votre expérience."
                : "Un numéro pour le suivi de vos commandes."}
            </Text>
          </View>

          {step === 0 ? (
            <View className="px-6 gap-6">
              <Input
                label="NOM COMPLET"
                placeholder="Marie Dupont"
                value={fullName}
                onChangeText={setFullName}
                error={fieldError.fullName}
                autoCapitalize="words"
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
                <View className="flex-row gap-4">
                  {(["particulier", "professionnel"] as AccountType[]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setAccountType(type)}
                      className="flex-1 py-3 rounded-full items-center"
                      style={{
                        backgroundColor: accountType === type ? COLORS.primary : "transparent",
                        borderWidth: accountType === type ? 0 : 1,
                        borderColor: `${COLORS.outlineVariant}33`,
                      }}
                    >
                      <Text
                        className="text-sm font-semibold uppercase"
                        style={{
                          color: accountType === type ? COLORS.onPrimary : COLORS.onSurface,
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
            </View>
          ) : (
            <View className="px-6 gap-6">
              <PhoneInput
                label="TÉLÉPHONE"
                countryCode={phoneCountry}
                onCountryChange={setPhoneCountry}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (fieldError.phone) setFieldError({});
                }}
                error={fieldError.phone}
              />
            </View>
          )}
        </ScrollView>

        {/* Footer CTA */}
        <View className="px-6 pb-2 pt-2">
          <Button
            label={step === 0 ? "CONTINUER" : "TERMINER"}
            onPress={step === 0 ? goNext : finish}
            loading={isLoading}
            size="lg"
          />
          {step === 1 && (
            <TouchableOpacity onPress={() => setStep(0)} className="items-center mt-4">
              <Text className="text-sm" style={{ color: COLORS.outline }}>
                Retour
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
