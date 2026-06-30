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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { TYPE } from "../../lib/typography";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { changePasswordApi } from "../../features/auth/api";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as "error" | "success",
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (current.length === 0) errs.current = "Mot de passe actuel requis";
    if (next.length < 8) errs.next = "Minimum 8 caractères";
    else if (!/[A-Z]/.test(next)) errs.next = "Au moins une majuscule";
    else if (!/[0-9]/.test(next)) errs.next = "Au moins un chiffre";
    if (confirm !== next) errs.confirm = "Les mots de passe ne correspondent pas";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await changePasswordApi(current, next);
      setToast({ visible: true, message: "Mot de passe modifié", type: "success" });
      setTimeout(() => router.back(), 700);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Modification impossible";
      setToast({ visible: true, message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Retour">
            <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={[TYPE.screenTitle, { flex: 1 }]}>
            Modifier mon mot de passe
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 20, marginTop: 8 }}>
            <Input
              label="MOT DE PASSE ACTUEL"
              value={current}
              onChangeText={setCurrent}
              error={fieldError.current}
              secureTextEntry
            />
            <Input
              label="NOUVEAU MOT DE PASSE"
              value={next}
              onChangeText={setNext}
              error={fieldError.next}
              secureTextEntry
            />
            <Input
              label="CONFIRMER LE NOUVEAU MOT DE PASSE"
              value={confirm}
              onChangeText={setConfirm}
              error={fieldError.confirm}
              secureTextEntry
            />
            <Button label="ENREGISTRER" onPress={handleSave} loading={loading} size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </SafeAreaView>
  );
}
