import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS } from "../../lib/constants";
import {
  listTicketsApi,
  getTicketApi,
  createTicketApi,
  replyTicketApi,
  type Ticket,
} from "../../features/tickets/api";

const CATEGORIES = [
  { value: "commande", label: "Commande" },
  { value: "livraison", label: "Livraison" },
  { value: "produit", label: "Produit" },
  { value: "paiement", label: "Paiement" },
  { value: "autre", label: "Autre" },
];

const STATUS_COLOR: Record<string, string> = {
  ouvert: COLORS.warning,
  en_cours: COLORS.primary,
  resolu: COLORS.success,
  ferme: COLORS.outline,
};

export default function SupportScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "new">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ticketsQ = useQuery({ queryKey: ["tickets"], queryFn: listTicketsApi });

  if (selectedId) {
    return <TicketThread id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Header
        title={mode === "new" ? "Signaler un problème" : "Mes tickets"}
        onBack={() => (mode === "new" ? setMode("list") : router.back())}
      />

      {mode === "new" ? (
        <NewTicketForm
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["tickets"] });
            setMode("list");
          }}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            {ticketsQ.isLoading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
            {ticketsQ.data?.length === 0 && (
              <Text style={{ textAlign: "center", color: COLORS.outline, marginTop: 40, fontFamily: "Inter_400Regular" }}>
                Aucun ticket. Signalez un problème et notre équipe vous répond.
              </Text>
            )}
            {ticketsQ.data?.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSelectedId(t.id)}
                style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.outlineVariant + "40" }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface, flex: 1 }} numberOfLines={1}>
                    {t.subject}
                  </Text>
                  <View style={{ backgroundColor: (STATUS_COLOR[t.status] ?? COLORS.outline) + "1a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: STATUS_COLOR[t.status] ?? COLORS.outline }}>{t.statusLabel}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: COLORS.outline, marginTop: 4, fontFamily: "Inter_400Regular" }}>
                  #{t.ticketNumber} · {t.categoryLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ position: "absolute", bottom: 24, left: 20, right: 20 }}>
            <TouchableOpacity
              onPress={() => setMode("new")}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Signaler un problème</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
      <TouchableOpacity onPress={onBack}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>{title}</Text>
    </View>
  );
}

function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("commande");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () => createTicketApi({ subject, category, description }),
    onSuccess: onCreated,
  });

  const canSubmit = subject.trim().length >= 3 && description.trim().length >= 5;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={labelStyle}>SUJET</Text>
        <TextInput value={subject} onChangeText={setSubject} placeholder="Ex : Colis endommagé à la livraison" placeholderTextColor={COLORS.outline} style={inputStyle} />

        <Text style={[labelStyle, { marginTop: 18 }]}>CATÉGORIE</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? COLORS.primary : COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: active ? COLORS.primary : COLORS.outlineVariant + "60" }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? "#fff" : COLORS.onSurfaceVariant }}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[labelStyle, { marginTop: 18 }]}>DESCRIPTION</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Décrivez le problème rencontré…"
          placeholderTextColor={COLORS.outline}
          multiline
          style={[inputStyle, { minHeight: 120, textAlignVertical: "top", paddingTop: 12 }]}
        />

        {mutation.isError && (
          <Text style={{ color: COLORS.error, fontSize: 13, marginTop: 12, fontFamily: "Inter_400Regular" }}>
            Envoi impossible. Réessayez.
          </Text>
        )}

        <TouchableOpacity
          disabled={!canSubmit || mutation.isPending}
          onPress={() => mutation.mutate()}
          style={{ backgroundColor: canSubmit ? COLORS.primary : COLORS.outlineVariant, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            {mutation.isPending ? "Envoi…" : "Envoyer le ticket"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TicketThread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const ticketQ = useQuery({ queryKey: ["ticket", id], queryFn: () => getTicketApi(id) });
  const replyM = useMutation({
    mutationFn: () => replyTicketApi(id, reply.trim()),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
  const t: Ticket | undefined = ticketQ.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Header title={t ? t.subject : "Ticket"} onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          {t && (
            <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: COLORS.outline, fontFamily: "Inter_400Regular" }}>
                #{t.ticketNumber} · {t.categoryLabel} · {t.statusLabel}
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.onSurface, marginTop: 8, fontFamily: "Inter_400Regular", lineHeight: 20 }}>
                {t.description}
              </Text>
            </View>
          )}
          {t?.messages?.map((m) => (
            <View key={m.id} style={{ alignSelf: m.sender === "customer" ? "flex-end" : "flex-start", maxWidth: "82%", backgroundColor: m.sender === "customer" ? COLORS.primary : COLORS.surfaceContainerLowest, borderRadius: 14, padding: 12, marginBottom: 10 }}>
              <Text style={{ color: m.sender === "customer" ? "#fff" : COLORS.onSurface, fontSize: 14, fontFamily: "Inter_400Regular" }}>{m.content}</Text>
            </View>
          ))}
        </ScrollView>

        {t && t.status !== "ferme" && (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.outlineVariant + "40" }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Votre message…"
              placeholderTextColor={COLORS.outline}
              multiline
              style={[inputStyle, { flex: 1, maxHeight: 100, minHeight: 44, paddingTop: 12 }]}
            />
            <TouchableOpacity
              disabled={!reply.trim() || replyM.isPending}
              onPress={() => replyM.mutate()}
              style={{ backgroundColor: reply.trim() ? COLORS.primary : COLORS.outlineVariant, borderRadius: 12, padding: 12 }}
            >
              <MaterialCommunityIcons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const labelStyle = {
  fontSize: 11,
  letterSpacing: 1,
  fontFamily: "Inter_600SemiBold" as const,
  color: COLORS.outline,
};
const inputStyle = {
  backgroundColor: COLORS.surfaceContainerLowest,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.outlineVariant + "60",
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  fontFamily: "Inter_400Regular" as const,
  color: COLORS.onSurface,
  marginTop: 8,
};
