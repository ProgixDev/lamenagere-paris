import React, { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Dimensions,
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
import { useGuestStore } from "../../features/auth/guest";

const { width: W, height: H } = Dimensions.get("window");
const isSmall = H < 700;

const loginSchema = z.object({
  email: z.string().min(1, "Email requis").email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuthStore();
  const enterGuest = useGuestStore((s) => s.enterGuest);

  const continueAsGuest = async () => {
    await Haptics.selectionAsync();
    enterGuest();
    router.replace("/(tabs)");
  };
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as const,
  });

  const onGoogle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await loginWithGoogle();
    } catch (e) {
      const message = (e as { message?: string })?.message ?? "";
      // User dismissed the Google sheet — not an error worth a toast.
      if (message.includes("annulée")) return;
      setToast({
        visible: true,
        message: message || "Connexion Google échouée",
        type: "error",
      });
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await login(data.email, data.password);
    } catch {
      setToast({
        visible: true,
        message: error || "Identifiants incorrects",
        type: "error",
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: isSmall ? 16 : 24 }}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={{
              width: W * 0.42,
              height: W * 0.42 * 0.5,
              resizeMode: "contain",
            }}
          />
        </View>

        {/* Heading */}
        <Text
          style={{
            fontSize: isSmall ? 24 : 28,
            marginBottom: isSmall ? 16 : 24,
            color: COLORS.primaryContainer,
            fontFamily: "Manrope_700Bold",
          }}
        >
          Connexion
        </Text>

        {/* Form */}
        <View style={{ gap: isSmall ? 14 : 18 }}>
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
                autoCapitalize="none"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="MOT DE PASSE"
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                error={errors.password?.message}
                secureTextEntry
              />
            )}
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            style={{ alignSelf: "flex-end", marginTop: -4 }}
          >
            <Text
              style={{
                fontSize: 12,
                color: COLORS.outline,
                fontFamily: "Inter_400Regular",
              }}
            >
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>

          <Button
            label="SE CONNECTER"
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            size="md"
          />
        </View>

        {/* Divider */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: isSmall ? 14 : 20,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: `${COLORS.outlineVariant}4d` }} />
          <Text
            style={{
              marginHorizontal: 14,
              fontSize: 13,
              color: COLORS.outline,
              fontFamily: "Inter_400Regular",
            }}
          >
            ou
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: `${COLORS.outlineVariant}4d` }} />
        </View>

        {/* Social buttons */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={onGoogle}
            disabled={isLoading}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: COLORS.outlineVariant,
              gap: 10,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <MaterialCommunityIcons name="google" size={18} color={COLORS.onSurface} />
            <Text style={{ fontSize: 13, color: COLORS.onSurface, fontFamily: "Inter_500Medium" }}>
              Continuer avec Google
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              borderRadius: 9999,
              backgroundColor: COLORS.onSurface,
              gap: 10,
            }}
          >
            <MaterialCommunityIcons name="apple" size={18} color="#ffffff" />
            <Text style={{ fontSize: 13, color: "#ffffff", fontFamily: "Inter_500Medium" }}>
              Continuer avec Apple
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: isSmall ? 16 : 24,
          }}
        >
          <Text style={{ fontSize: 13, color: COLORS.outline, fontFamily: "Inter_400Regular" }}>
            Pas encore de compte ?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={{ fontSize: 13, color: COLORS.primary, fontFamily: "Inter_700Bold" }}>
              Créer un compte
            </Text>
          </TouchableOpacity>
        </View>

        {/* Guest / ghost mode */}
        <TouchableOpacity
          onPress={continueAsGuest}
          accessibilityRole="button"
          accessibilityLabel="Continuer sans compte"
          style={{ alignItems: "center", marginTop: isSmall ? 12 : 16 }}
        >
          <Text style={{ fontSize: 13, color: COLORS.outline, fontFamily: "Inter_500Medium" }}>
            Continuer sans compte
          </Text>
        </TouchableOpacity>
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
