import React, { useEffect, useState } from "react";
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
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { COLORS } from "../../lib/constants";

WebBrowser.maybeCompleteAuthSession();
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { useAuthStore } from "../../features/auth/store";

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
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as const,
  });

  const [googleRequest, googleResponse, googlePrompt] =
    Google.useIdTokenAuthRequest({
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

  useEffect(() => {
    if (googleResponse?.type !== "success") return;
    const idToken = googleResponse.params?.id_token;
    if (!idToken) return;
    loginWithGoogle(idToken).catch(() =>
      setToast({ visible: true, message: "Connexion Google échouée", type: "error" }),
    );
  }, [googleResponse, loginWithGoogle]);

  const onGoogle = async () => {
    if (!googleRequest) {
      setToast({
        visible: true,
        message: "Connexion Google non configurée",
        type: "error",
      });
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await googlePrompt();
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
            disabled={!googleRequest}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 12,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: COLORS.outlineVariant,
              gap: 10,
              opacity: googleRequest ? 1 : 0.5,
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
