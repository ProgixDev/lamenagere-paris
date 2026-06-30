import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { FONTS, TYPE, SPACE, SHADOW } from "../../lib/typography";
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from "../../features/addresses/hooks";
import type { AddressInput } from "../../features/addresses/api";
import type { Address } from "../../lib/types";
import AddressFormModal from "../../components/address/AddressFormModal";
import Toast from "../../components/ui/Toast";

export default function AddressesScreen() {
  const router = useRouter();
  const { data: addresses = [], isLoading, isError, refetch } = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();
  const setDefaultAddress = useSetDefaultAddress();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setModalVisible(true);
  };

  const handleSubmit = (payload: AddressInput) => {
    if (editing) {
      updateAddress.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            setModalVisible(false);
            setToast({ message: "Adresse mise à jour", type: "success" });
          },
          onError: (e: any) =>
            setToast({
              message: e?.message || "Échec de la mise à jour",
              type: "error",
            }),
        },
      );
    } else {
      createAddress.mutate(payload, {
        onSuccess: () => {
          setModalVisible(false);
          setToast({ message: "Adresse ajoutée", type: "success" });
        },
        onError: (e: any) =>
          setToast({
            message: e?.message || "Échec de l'ajout",
            type: "error",
          }),
      });
    }
  };

  const confirmDelete = (addr: Address) => {
    Alert.alert(
      "Supprimer l'adresse",
      "Voulez-vous vraiment supprimer cette adresse ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () =>
            deleteAddress.mutate(addr.id, {
              onSuccess: () =>
                setToast({ message: "Adresse supprimée", type: "success" }),
              onError: (e: any) =>
                setToast({
                  message: e?.message || "Échec de la suppression",
                  type: "error",
                }),
            }),
        },
      ],
    );
  };

  const handleSetDefault = (addr: Address) => {
    if (addr.isDefault) return;
    setDefaultAddress.mutate(addr.id, {
      onError: (e: any) =>
        setToast({
          message: e?.message || "Échec",
          type: "error",
        }),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Retour">
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={TYPE.screenTitle}>
          Mes Adresses
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Add button */}
        <TouchableOpacity
          onPress={openCreate}
          accessibilityLabel="Ajouter une adresse"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 16,
            paddingVertical: 17,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: COLORS.outlineVariant,
            marginBottom: SPACE.lg,
          }}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
          <Text style={{ fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.primary }}>
            Ajouter une adresse
          </Text>
        </TouchableOpacity>

        {isLoading ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : isError ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.surfaceContainer, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={28} color={COLORS.error} />
            </View>
            <Text style={[TYPE.sectionTitle, { marginBottom: 4 }]}>
              Erreur de chargement
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.primary }}>
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        ) : addresses.length > 0 ? (
          addresses.map((addr) => (
            <View
              key={addr.id}
              style={{
                backgroundColor: COLORS.surfaceContainerLowest,
                borderRadius: 16,
                padding: SPACE.lg,
                marginBottom: 12,
                ...SHADOW.card,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: FONTS.bodySemibold, color: COLORS.onSurface, marginBottom: 4 }}>
                    {addr.firstName} {addr.lastName}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.onSurfaceVariant, lineHeight: 20 }}>
                    {addr.street}{"\n"}{addr.postalCode} {addr.city}
                  </Text>
                  {addr.isDefault ? (
                    <View style={{ marginTop: 10, alignSelf: "flex-start", backgroundColor: `${COLORS.primary}12`, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontFamily: FONTS.bodySemibold, color: COLORS.primary }}>Par défaut</Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => handleSetDefault(addr)} style={{ marginTop: 10, alignSelf: "flex-start" }}>
                      <Text style={{ fontSize: 11, fontFamily: FONTS.bodySemibold, color: COLORS.primary }}>
                        Définir par défaut
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={{ padding: 4 }} onPress={() => openEdit(addr)} accessibilityLabel="Modifier l'adresse">
                    <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.outline} />
                  </TouchableOpacity>
                  <TouchableOpacity style={{ padding: 4 }} onPress={() => confirmDelete(addr)} accessibilityLabel="Supprimer l'adresse">
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.surfaceContainer, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={[TYPE.sectionTitle, { marginBottom: 4 }]}>
              Aucune adresse
            </Text>
            <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.onSurfaceVariant, textAlign: "center" }}>
              Ajoutez une adresse de livraison{"\n"}pour accélérer vos commandes
            </Text>
          </View>
        )}
      </ScrollView>

      <AddressFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
        loading={createAddress.isPending || updateAddress.isPending}
        initial={editing}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          visible={!!toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </SafeAreaView>
  );
}
