import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";

const SECTIONS = [
  {
    title: "1. Objet",
    body: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application mobile La Ménagère Paris, éditée par la société La Ménagère Paris SAS, immatriculée au RCS de Paris.\n\nL'utilisation de l'application implique l'acceptation pleine et entière des présentes CGU.",
  },
  {
    title: "2. Accès à l'application",
    body: "L'application est accessible gratuitement depuis un smartphone ou une tablette. Les frais d'accès au réseau sont à la charge de l'utilisateur.\n\nLa Ménagère Paris se réserve le droit de modifier, suspendre ou interrompre l'accès à tout ou partie de l'application, à tout moment et sans préavis.",
  },
  {
    title: "3. Création de compte",
    body: "L'accès à certaines fonctionnalités nécessite la création d'un compte utilisateur. L'utilisateur s'engage à fournir des informations exactes et à jour.\n\nDeux types de comptes sont disponibles :\n• Particulier : pour les consommateurs\n• Professionnel : pour les entreprises (numéro SIRET requis)\n\nL'utilisateur est responsable de la confidentialité de ses identifiants de connexion.",
  },
  {
    title: "4. Commandes",
    body: "Les produits présentés sur l'application sont vendus en euros (€) toutes taxes comprises. Les prix peuvent être modifiés à tout moment.\n\nCertains produits sont vendus au mètre carré : leur prix est calculé automatiquement à partir des dimensions saisies par le client.\n\nToute commande validée constitue un contrat de vente entre l'utilisateur et La Ménagère Paris.",
  },
  {
    title: "5. Livraison",
    body: "La Ménagère Paris assure la livraison en France métropolitaine et dans les départements et régions d'outre-mer (La Réunion, Mayotte, Guadeloupe, Martinique, Guyane).\n\nDélais indicatifs :\n• France métropolitaine : 2 à 3 semaines\n• Outre-mer : 8 à 12 semaines (expédition par conteneur maritime)\n\nLes délais sont donnés à titre indicatif et ne constituent pas un engagement contractuel.",
  },
  {
    title: "6. Propriété intellectuelle",
    body: "L'ensemble des contenus de l'application (textes, images, logos, vidéos, design) est protégé par le droit d'auteur et le droit des marques.\n\nToute reproduction, représentation ou diffusion, totale ou partielle, est interdite sans autorisation préalable écrite.",
  },
  {
    title: "7. Données personnelles",
    body: "La collecte et le traitement des données personnelles sont effectués conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.\n\nPour plus d'informations, consultez notre Politique de Confidentialité.",
  },
  {
    title: "8. Droit applicable",
    body: "Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux compétents de Paris seront seuls compétents.",
  },
];

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Conditions générales
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline, marginBottom: 20 }}>
          Dernière mise à jour : 1er janvier 2026
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 8 }}>
              {section.title}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, lineHeight: 21 }}>
              {section.body}
            </Text>
          </View>
        ))}

        <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, lineHeight: 18 }}>
            Pour toute question relative aux présentes conditions, contactez-nous à l'adresse : contact@lamenagereparis.fr
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
