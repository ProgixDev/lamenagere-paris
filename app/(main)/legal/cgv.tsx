import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";

const SECTIONS = [
  {
    title: "1. Champ d'application",
    body: "Les présentes Conditions Générales de Vente (CGV) s'appliquent à toutes les ventes de produits effectuées par La Ménagère Paris SAS via l'application mobile, à destination de clients particuliers et professionnels résidant en France métropolitaine et dans les départements et régions d'outre-mer.",
  },
  {
    title: "2. Produits",
    body: "Les produits proposés sont décrits avec la plus grande exactitude possible. Les photographies sont non contractuelles.\n\nDeux types de produits sont disponibles :\n• Produits à prix fixe : achat direct au prix affiché\n• Produits au m² : prix calculé automatiquement selon les dimensions saisies (prix au m² × surface)",
  },
  {
    title: "3. Prix",
    body: "Les prix sont indiqués en euros (€) toutes taxes comprises (TTC). Ils comprennent la TVA applicable au jour de la commande.\n\nLes frais de livraison sont calculés en fonction de la zone de livraison et sont indiqués avant la validation de la commande.\n\nLa Ménagère Paris se réserve le droit de modifier ses prix à tout moment. Les produits seront facturés au prix en vigueur au moment de la validation de la commande.",
  },
  {
    title: "4. Commandes",
    body: "La validation d'une commande implique l'acceptation des présentes CGV et constitue un contrat de vente.\n\nLa Ménagère Paris se réserve le droit de refuser ou d'annuler toute commande en cas de litige antérieur, de suspicion de fraude ou d'indisponibilité du produit.\n\nUn e-mail de confirmation est envoyé à l'utilisateur après chaque commande.",
  },
  {
    title: "5. Paiement",
    body: "Le paiement s'effectue en ligne par carte bancaire via notre prestataire de paiement sécurisé (Stripe).\n\nLe montant est débité au moment de la validation de la commande.\n\nPour les professionnels, un paiement par virement bancaire peut être proposé sur demande.",
  },
  {
    title: "6. Livraison",
    body: "Zones de livraison et délais indicatifs :\n\n• France métropolitaine : 2 à 3 semaines\n• La Réunion, Mayotte : 8 à 12 semaines\n• Guadeloupe, Martinique, Guyane : 8 à 12 semaines\n\nLes livraisons outre-mer sont effectuées par conteneur maritime. Une équipe dédiée assure le suivi de l'expédition.\n\nLe client est informé par notification de l'avancement de sa commande.\n\nEn cas de retard significatif (supérieur à 15 jours ouvrés), le client peut annuler sa commande et obtenir un remboursement intégral.",
  },
  {
    title: "7. Droit de rétractation",
    body: "Conformément au Code de la consommation, le client particulier dispose d'un délai de 14 jours à compter de la réception du produit pour exercer son droit de rétractation, sans avoir à justifier de motif.\n\nLes produits fabriqués sur mesure ou personnalisés sont exclus du droit de rétractation.\n\nLes frais de retour sont à la charge du client. Le remboursement est effectué dans un délai de 14 jours après réception du produit retourné.",
  },
  {
    title: "8. Garanties",
    body: "Tous les produits bénéficient de :\n\n• La garantie légale de conformité (2 ans)\n• La garantie contre les vices cachés\n\nPour toute réclamation, contactez notre service client via l'application ou par e-mail.",
  },
  {
    title: "9. Responsabilité",
    body: "La Ménagère Paris ne saurait être tenue responsable en cas de :\n\n• Force majeure\n• Utilisation non conforme du produit\n• Dommages causés par le transporteur (constat à effectuer à la livraison)\n\nEn cas de produit endommagé à la livraison, le client doit émettre des réserves écrites auprès du transporteur et nous contacter sous 48 heures.",
  },
  {
    title: "10. Litiges",
    body: "En cas de litige, le client peut recourir à un médiateur de la consommation. La liste des médiateurs agréés est disponible sur le site du Ministère de l'Économie.\n\nÀ défaut de résolution amiable, les tribunaux compétents de Paris seront seuls compétents.",
  },
];

export default function CGVScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Conditions Générales de Vente
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline, marginBottom: 20 }}>
          Dernière mise à jour : 1er janvier 2026
        </Text>

        <View style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, lineHeight: 18 }}>
            Les présentes CGV régissent les ventes effectuées sur l'application La Ménagère Paris. Toute commande implique l'acceptation sans réserve de ces conditions.
          </Text>
        </View>

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
            Service client : contact@lamenagereparis.fr{"\n"}
            La Ménagère Paris SAS — Paris, France
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
