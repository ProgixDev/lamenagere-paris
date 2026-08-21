import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { apiClient } from "../../lib/api";

export type Attachment = { url: string; type: "image" | "video" };

/**
 * Longest edge we keep. Attachments are shown as thumbnails and, at most, a
 * full-screen preview — a 4032px iPhone original is ~10x more pixels than any
 * of that needs, and we pay for every byte in storage and on the customer's
 * mobile data.
 */
const MAX_EDGE = 1600;

/** JPEG quality. 0.7 is the usual knee: well below it artefacts get visible. */
const JPEG_QUALITY = 0.7;

/** Opens the gallery so the user can pick a photo or a video. */
export async function pickMessageMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
  // iOS seulement. Sur Android, launchImageLibraryAsync ouvre le sélecteur
  // système, qui ne rend que le média choisi et ne demande donc aucune
  // permission — Play interdit READ_MEDIA_IMAGES/VIDEO dès lors qu'il suffit.
  if (Platform.OS === "ios") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission requise",
        "Autorisez l'accès à la galerie pour envoyer une photo ou une vidéo.",
      );
      return null;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    // Full quality out of the picker: uploadMessageMedia does the single
    // compression pass. Asking the picker to re-encode too would stack two
    // lossy passes on Android for no gain.
    quality: 1,
    videoMaxDuration: 60,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/**
 * Downscales to MAX_EDGE (only when the image is bigger — never upscales) and
 * re-encodes as JPEG.
 *
 * The re-encode matters as much as the resize: iOS hands back the camera roll
 * original, which for any recent iPhone is HEIC. No desktop browser decodes
 * HEIC and neither does Android's <Image>, so an untouched upload is a broken
 * image everywhere but the device it came from.
 */
async function compressImage(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ uri: string; name: string; mime: string } | null> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const { width, height } = asset;
    if (width && height && Math.max(width, height) > MAX_EDGE) {
      // resize() derives the omitted side, so constrain the longer one.
      context.resize(
        width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE },
      );
    }
    const image = await context.renderAsync();
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
    });
    const base = (asset.fileName ?? asset.uri.split("/").pop() ?? "photo")
      .replace(/\.[^.]+$/, "");
    return { uri: result.uri, name: `${base}.jpg`, mime: "image/jpeg" };
  } catch {
    // A codec we can't read shouldn't cost the customer their attachment —
    // fall back to uploading the original.
    return null;
  }
}

/** Uploads a picked asset to the messages bucket and returns its public URL + type. */
export async function uploadMessageMedia(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Attachment> {
  const isVideo = asset.type === "video";
  // Videos are left alone: re-encoding one on-device is slow enough that the
  // customer would notice, and videoMaxDuration already caps the size.
  const compressed = isVideo ? null : await compressImage(asset);

  const name =
    compressed?.name ??
    asset.fileName ??
    asset.uri.split("/").pop() ??
    (isVideo ? "video.mp4" : "image.jpg");
  const ext = name.split(".").pop()?.toLowerCase();
  const mime =
    compressed?.mime ??
    asset.mimeType ??
    (isVideo
      ? `video/${ext === "mov" ? "quicktime" : ext ?? "mp4"}`
      : `image/${ext === "jpg" ? "jpeg" : ext ?? "jpeg"}`);

  const form = new FormData();
  form.append("file", {
    uri: compressed?.uri ?? asset.uri,
    name,
    type: mime,
  } as never);

  const { data } = await apiClient.post<{ url: string; type: string }>(
    "/uploads",
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 },
  );

  return { url: data.url, type: data.type === "video" ? "video" : "image" };
}
