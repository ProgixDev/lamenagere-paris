import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission requise", "Autorisez l'accès à la caméra pour scanner un produit.");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

async function pickFromLibrary(): Promise<string | null> {
  // Android n'a pas de permission à demander ici : le picker passe par le
  // sélecteur système (Photo Picker), qui ne donne accès qu'à la photo choisie.
  // Demander quand même échouerait, puisqu'on ne déclare plus READ_MEDIA_IMAGES.
  if (Platform.OS === "ios") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission requise", "Autorisez l'accès à la galerie pour la recherche par image.");
      return null;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function pickVisualSearchImage(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Recherche par image",
      "Scannez un produit avec votre caméra ou choisissez une photo dans votre galerie.",
      [
        {
          text: "Prendre une photo",
          onPress: async () => resolve(await takePhoto()),
        },
        {
          text: "Choisir dans la galerie",
          onPress: async () => resolve(await pickFromLibrary()),
        },
        {
          text: "Annuler",
          style: "cancel",
          onPress: () => resolve(null),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
