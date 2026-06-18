import React from "react";
import { View, Image } from "react-native";

/**
 * Centered brand logo shown at the top of every signed-in tab screen
 * (Accueil, Catégories, Panier, Messages, Profil). Sits inside each
 * screen's existing SafeAreaView, above the rest of the header content.
 */
export default function LogoHeader() {
  return (
    <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={{ width: 200, height: 60, resizeMode: "contain" }}
      />
    </View>
  );
}
