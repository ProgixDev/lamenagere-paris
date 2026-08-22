import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import {
  PHONE_COUNTRIES,
  SUGGESTED_PHONE_COUNTRIES,
  PhoneCountry,
  findPhoneCountry,
  searchPhoneCountries,
} from "../../lib/phone";

interface PhoneInputProps {
  label?: string;
  countryCode: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
}

type Row = PhoneCountry | { header: string };

const isHeader = (row: Row): row is { header: string } => "header" in row;

/**
 * Phone field with a worldwide country-dial-code selector (flag + indicatif).
 * The local number is held in `value`; callers combine it with the country via
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
  const [query, setQuery] = useState("");

  const country = findPhoneCountry(countryCode) ?? PHONE_COUNTRIES[0];
  const borderColor = error
    ? COLORS.error
    : isFocused
      ? COLORS.primary
      : COLORS.outlineVariant;

  const rows: Row[] = useMemo(() => {
    const matches = searchPhoneCountries(query);
    if (query.trim()) return matches;

    const suggested = SUGGESTED_PHONE_COUNTRIES.map(findPhoneCountry).filter(
      Boolean,
    ) as PhoneCountry[];
    return [
      { header: "Suggestions" },
      ...suggested,
      { header: "Tous les pays" },
      ...matches,
    ];
  }, [query]);

  const closePicker = () => {
    setPickerOpen(false);
    setQuery("");
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (isHeader(item)) {
      return (
        <Text
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontFamily: "Inter_600SemiBold",
            color: COLORS.outline,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 8,
          }}
        >
          {item.header}
        </Text>
      );
    }

    const selected = item.code === country.code;
    return (
      <TouchableOpacity
        onPress={() => {
          onCountryChange(item.code);
          closePicker();
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ fontSize: 22 }}>{item.flag}</Text>
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: "Inter_500Medium",
            color: COLORS.onSurface,
          }}
        >
          {item.label}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: COLORS.outline,
            fontFamily: "Inter_500Medium",
          }}
        >
          {item.dialCode}
        </Text>
        {selected && (
          <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

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
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}>
          <Pressable style={{ flex: 1 }} onPress={closePicker} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ height: "78%" }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingTop: 18,
                  paddingBottom: 12,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 18,
                    fontFamily: "Inter_600SemiBold",
                    color: COLORS.onSurface,
                  }}
                >
                  Indicatif du pays
                </Text>
                <TouchableOpacity onPress={closePicker} hitSlop={10}>
                  <MaterialCommunityIcons name="close" size={22} color={COLORS.outline} />
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginHorizontal: 20,
                  marginBottom: 8,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: COLORS.surfaceContainerLow,
                }}
              >
                <MaterialCommunityIcons name="magnify" size={18} color={COLORS.outline} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher un pays ou un indicatif"
                  placeholderTextColor={COLORS.outline}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: COLORS.onSurface,
                    fontFamily: "Inter_400Regular",
                  }}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={16}
                      color={COLORS.outline}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={rows}
                keyExtractor={(item, index) =>
                  isHeader(item) ? `h-${item.header}` : `${item.code}-${index}`
                }
                renderItem={renderRow}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                ListEmptyComponent={
                  <Text
                    style={{
                      textAlign: "center",
                      paddingVertical: 40,
                      color: COLORS.outline,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    Aucun pays trouvé
                  </Text>
                }
                contentContainerStyle={{ paddingBottom: 32 }}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
