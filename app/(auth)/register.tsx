import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { useAuthStore } from "../../features/auth/store";
import type { AccountType } from "../../lib/types";

const registerSchema = z
  .object({
    accountType: z.enum(["particulier", "professionnel"]),
    fullName: z.string().min(1, "Nom complet requis"),
    email: z.string().min(1, "Email requis").email("Email invalide"),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirmPassword: z.string().min(1, "Confirmation requise"),
    company: z.string().optional(),
    siret: z.string().optional(),
    acceptTerms: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  .refine((data) => data.acceptTerms === true, {
    message: "Vous devez accepter les conditions",
    path: ["acceptTerms"],
  })
  .refine(
    (data) =>
      data.accountType !== "professionnel" || (data.company?.trim().length ?? 0) > 0,
    { message: "Nom de l'entreprise requis", path: ["company"] },
  )
  .refine(
    (data) =>
      data.accountType !== "professionnel" ||
      /^\d{14}$/.test((data.siret ?? "").replace(/\s/g, "")),
    { message: "SIRET invalide (14 chiffres)", path: ["siret"] },
  );

type RegisterForm = z.infer<typeof registerSchema>;

// Fields validated before advancing past each step.
const STEP_FIELDS: (keyof RegisterForm)[][] = [
  ["accountType", "fullName", "company", "siret"],
  ["email", "phone"],
  ["password", "confirmPassword", "acceptTerms"],
];

const STEP_META = [
  { eyebrow: "ÉTAPE 1 / 3", title: "Votre identité", subtitle: "Dites-nous qui vous êtes." },
  { eyebrow: "ÉTAPE 2 / 3", title: "Vos coordonnées", subtitle: "Pour vous joindre et sécuriser votre compte." },
  { eyebrow: "ÉTAPE 3 / 3", title: "Votre mot de passe", subtitle: "Choisissez un mot de passe robuste." },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState({ visible: false, message: "", type: "error" as const });

  const {
    control,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      accountType: "particulier",
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      company: "",
      siret: "",
      acceptTerms: false,
    },
  });

  const accountType = watch("accountType");
  const setAccountType = (type: AccountType) =>
    setValue("accountType", type, { shouldValidate: false });

  const isLastStep = step === STEP_META.length - 1;

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (!valid) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastStep) {
      handleSubmit(onSubmit)();
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((s) => s - 1);
  };

  const onSubmit = async (data: RegisterForm) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await registerUser({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        accountType: data.accountType,
        company: data.company,
        siret: data.siret,
      });
    } catch {
      setToast({
        visible: true,
        message: error || "Erreur lors de l’inscription",
        type: "error",
      });
    }
  };

  const meta = STEP_META[step];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity onPress={goBack} hitSlop={8}>
            <MaterialCommunityIcons
              name={step === 0 ? "close" : "arrow-left"}
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
          <Text
            className="text-xs uppercase tracking-widest"
            style={{ color: COLORS.outline }}
          >
            CRÉER UN COMPTE
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress bar */}
        <View className="flex-row gap-2 px-6 mb-6">
          {STEP_META.map((_, i) => (
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
          {/* Heading */}
          <View className="px-6 mb-1">
            <Text
              className="text-xs uppercase tracking-widest"
              style={{ color: COLORS.secondary, fontFamily: "Inter_600SemiBold" }}
            >
              {meta.eyebrow}
            </Text>
          </View>
          <View className="px-6 mb-1">
            <Text
              className="text-3xl"
              style={{ color: COLORS.primaryContainer, fontFamily: "Manrope_700Bold" }}
            >
              {meta.title}
            </Text>
          </View>
          <View className="px-6 mb-8">
            <Text className="text-sm" style={{ color: COLORS.outline }}>
              {meta.subtitle}
            </Text>
          </View>

          {/* ── Step 1: identity ───────────────────────────── */}
          {step === 0 && (
            <View className="px-6 gap-6">
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

              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="NOM COMPLET"
                    placeholder="Marie Dupont"
                    value={value}
                    onChangeText={onChange}
                    error={errors.fullName?.message}
                    autoCapitalize="words"
                  />
                )}
              />

              {accountType === "professionnel" && (
                <>
                  <Controller
                    control={control}
                    name="company"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        label="NOM DE L'ENTREPRISE"
                        value={value ?? ""}
                        onChangeText={onChange}
                        error={errors.company?.message}
                        autoCapitalize="words"
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="siret"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        label="SIRET"
                        placeholder="14 chiffres"
                        value={value ?? ""}
                        onChangeText={onChange}
                        error={errors.siret?.message}
                        keyboardType="number-pad"
                      />
                    )}
                  />
                </>
              )}
            </View>
          )}

          {/* ── Step 2: contact ────────────────────────────── */}
          {step === 1 && (
            <View className="px-6 gap-6">
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="EMAIL"
                    placeholder="nom@example.com"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                    keyboardType="email-address"
                  />
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="TÉLÉPHONE (OPTIONNEL)"
                    placeholder="+33 6 00 00 00 00"
                    value={value ?? ""}
                    onChangeText={onChange}
                    keyboardType="phone-pad"
                  />
                )}
              />
            </View>
          )}

          {/* ── Step 3: security ───────────────────────────── */}
          {step === 2 && (
            <View className="px-6 gap-6">
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="MOT DE PASSE"
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                    secureTextEntry
                  />
                )}
              />
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="CONFIRMER MOT DE PASSE"
                    value={value}
                    onChangeText={onChange}
                    error={errors.confirmPassword?.message}
                    secureTextEntry
                  />
                )}
              />

              <Controller
                control={control}
                name="acceptTerms"
                render={({ field: { onChange, value } }) => (
                  <TouchableOpacity
                    onPress={() => onChange(!value)}
                    className="flex-row gap-3"
                  >
                    <View
                      className="w-5 h-5 rounded items-center justify-center mt-0.5"
                      style={{
                        backgroundColor: value ? COLORS.primary : "transparent",
                        borderWidth: value ? 0 : 1.5,
                        borderColor: COLORS.outlineVariant,
                      }}
                    >
                      {value && (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      )}
                    </View>
                    <Text className="flex-1 text-sm" style={{ color: COLORS.onSurface }}>
                      J'accepte les conditions générales et la politique de
                      confidentialité de La Ménagère Paris
                    </Text>
                  </TouchableOpacity>
                )}
              />
              {errors.acceptTerms && (
                <Text className="text-xs" style={{ color: COLORS.error }}>
                  {errors.acceptTerms.message}
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer CTA */}
        <View className="px-6 pb-2 pt-2">
          <Button
            label={isLastStep ? "CRÉER MON COMPTE" : "CONTINUER"}
            onPress={goNext}
            loading={isLoading}
            size="lg"
          />

          {step === 0 && (
            <View className="flex-row items-center justify-center mt-5">
              <Text className="text-sm" style={{ color: COLORS.outline }}>
                Déjà un compte ?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                <Text className="text-sm font-bold" style={{ color: COLORS.primary }}>
                  Se connecter
                </Text>
              </TouchableOpacity>
            </View>
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
