import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiClient } from "../../lib/api";

export type Attachment = { url: string; type: "image" | "video" };

/** Opens the gallery so the user can pick a photo or a video. */
export async function pickMessageMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission requise",
      "Autorisez l'accès à la galerie pour envoyer une photo ou une vidéo.",
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.7,
    videoMaxDuration: 60,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/** Uploads a picked asset to the messages bucket and returns its public URL + type. */
export async function uploadMessageMedia(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Attachment> {
  const isVideo = asset.type === "video";
  const name =
    asset.fileName ??
    asset.uri.split("/").pop() ??
    (isVideo ? "video.mp4" : "image.jpg");
  const ext = name.split(".").pop()?.toLowerCase();
  const mime =
    asset.mimeType ??
    (isVideo
      ? `video/${ext === "mov" ? "quicktime" : ext ?? "mp4"}`
      : `image/${ext === "jpg" ? "jpeg" : ext ?? "jpeg"}`);

  const form = new FormData();
  form.append("file", { uri: asset.uri, name, type: mime } as never);

  const { data } = await apiClient.post<{ url: string; type: string }>(
    "/uploads",
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 },
  );

  return { url: data.url, type: data.type === "video" ? "video" : "image" };
}
