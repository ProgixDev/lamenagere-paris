import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { COLORS, TERRITORIES } from "../../lib/constants";
import { isValidPostalCode } from "../../lib/utils";
import type { Address, ShippingZone } from "../../lib/types";
import type { AddressInput } from "../../features/addresses/api";

interface AddressFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: AddressInput) => void;
  loading?: boolean;
  initial?: Address | null;
}

const EMPTY = {
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
  territory: "metropole" as ShippingZone,
};

export default function AddressFormModal({
  visible,
  onClose,
  onSubmit,
  loading = false,
  initial,
}: AddressFormModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setErrors({});
      setForm(
        initial
          ? {
              firstName: initial.firstName,
              lastName: initial.lastName,
              street: initial.street,
              postalCode: initial.postalCode,
              city: initial.city,
              territory: initial.territory,
            }
          : EMPTY,
      );
    }
  }, [visible, initial]);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Prénom requis";
    if (!form.lastName.trim()) next.lastName = "Nom requis";
    if (!form.street.trim()) next.street = "Adresse requise";
    if (!form.postalCode.trim()) next.postalCode = "Code postal requis";
    else if (!isValidPostalCode(form.postalCode))
      next.postalCode = "Code postal invalide";
    if (!form.city.trim()) next.city = "Ville requise";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      street: form.street.trim(),
      postalCode: form.postalCode.trim(),
      city: form.city.trim(),
      territory: form.territory,
    });
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={initial ? "Modifier l'adresse" : "Nouvelle adresse"}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="PRÉNOM"
                value={form.firstName}
                onChangeText={set("firstName")}
                error={errors.firstName}
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="NOM"
                value={form.lastName}
                onChangeText={set("lastName")}
                error={errors.lastName}
                autoCapitalize="words"
              />
            </View>
          </View>
          <Input
            label="ADRESSE"
            value={form.street}
            onChangeText={set("street")}
            error={errors.street}
            autoCapitalize="sentences"
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="CODE POSTAL"
                value={form.postalCode}
                onChangeText={set("postalCode")}
                error={errors.postalCode}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="VILLE"
                value={form.city}
                onChangeText={set("city")}
                error={errors.city}
                autoCapitalize="words"
              />
            </View>
          </View>

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
              PAYS/TERRITOIRE
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {TERRITORIES.map((t) => {
                const active = form.territory === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        territory: t.value as ShippingZone,
                      }))
                    }
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 9999,
                      backgroundColor: active ? COLORS.primary : "transparent",
                      borderWidth: 1,
                      borderColor: active
                        ? COLORS.primary
                        : `${COLORS.outlineVariant}33`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: active
                          ? "Inter_600SemiBold"
                          : "Inter_500Medium",
                        color: active ? COLORS.onPrimary : COLORS.onSurface,
                      }}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ marginTop: 8 }}>
            <Button
              label={initial ? "Enregistrer" : "Ajouter"}
              onPress={handleSubmit}
              loading={loading}
              size="lg"
            />
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
