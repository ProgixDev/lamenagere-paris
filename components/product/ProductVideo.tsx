import React from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

/**
 * A single product gallery video. Uses expo-video with native controls
 * (same infra as message attachments). Does not autoplay — the shopper taps
 * play. Sized to fill the gallery cell.
 */
export default function ProductVideo({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
  });

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}
