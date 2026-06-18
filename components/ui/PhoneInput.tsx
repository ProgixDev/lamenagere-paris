import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { PHONE_COUNTRIES } from "../../lib/phone";

interface PhoneInputProps {
  label?: string;
  countryCode: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
}

/**
 * Phone field with a country-dial-code selector (France / Sénégal). The local
 * number is held in `value`; callers combine it with the country via
 * `combinePhone()` from lib/phone when submitting.
 */
export default function PhoneInput({
  label,
  countryCode,
  onCountryChange,
  value,
  onChangeText,
  error,
  placeholder = "6 12 34 56 78",
}: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const country =
    PHONE_COUNTRIES.find((c) => c.code === countryCode) ?? PHONE_COUNTRIES[0];
  const borderColor = error
    ? COLORS.error
    : isFocused
      ? COLORS.primary
      : COLORS.outlineVariant;

  return (
    <View>
      {label && (
        <Text
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontFamily: "Inter_600SemiBold",
            color: COLORS.outline,
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 12,
            paddingRight: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>{country.flag}</Text>
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>
            {country.dialCode}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.outline} />
        </TouchableOpacity>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.surfaceDim}
          keyboardType="phone-pad"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            paddingVertical: 12,
            fontSize: 14,
            color: COLORS.onSurface,
            backgroundColor: "transparent",
            fontFamily: "Inter_400Regular",
          }}
        />
      </View>
      {error && (
        <Text
          style={{
            fontSize: 12,
            marginTop: 4,
            color: COLORS.error,
            fontFamily: "Inter_400Regular",
          }}
        >
          {error}
        </Text>
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" }}>
            {PHONE_COUNTRIES.map((c, i) => (
              <TouchableOpacity
                key={c.code}
                onPress={() => {
                  onCountryChange(c.code);
                  setPickerOpen(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "#f0f0f0",
                }}
              >
                <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                <Text style={{ flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>
                  {c.label}
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.outline, fontFamily: "Inter_500Medium" }}>
                  {c.dialCode}
                </Text>
                {c.code === country.code && (
                  <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
