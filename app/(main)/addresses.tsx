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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Mes Adresses
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Add button */}
        <TouchableOpacity
          onPress={openCreate}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: "#ffffff",
            borderRadius: 14,
            paddingVertical: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: `${COLORS.outlineVariant}66`,
            marginBottom: 16,
          }}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.secondary} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>
            Ajouter une adresse
          </Text>
        </TouchableOpacity>

        {isLoading ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : isError ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#f0ebe6", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={28} color={COLORS.error} />
            </View>
            <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 4 }}>
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
                backgroundColor: "#ffffff",
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface, marginBottom: 4 }}>
                    {addr.firstName} {addr.lastName}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, lineHeight: 20 }}>
                    {addr.street}{"\n"}{addr.postalCode} {addr.city}
                  </Text>
                  {addr.isDefault ? (
                    <View style={{ marginTop: 8, alignSelf: "flex-start", backgroundColor: `${COLORS.primary}12`, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: COLORS.primary }}>Par défaut</Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => handleSetDefault(addr)} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>
                        Définir par défaut
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={{ padding: 4 }} onPress={() => openEdit(addr)}>
                    <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.outline} />
                  </TouchableOpacity>
                  <TouchableOpacity style={{ padding: 4 }} onPress={() => confirmDelete(addr)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#dc3545" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#f0ebe6", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={28} color={COLORS.secondary} />
            </View>
            <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 4 }}>
              Aucune adresse
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, textAlign: "center" }}>
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
