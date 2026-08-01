import { useEffect } from "react";
import { AppState, Keyboard, Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";

// Android phones with the 3-button (or gesture pill) navigation bar keep it
// docked at the bottom of every app. The `expo-navigation-bar` config plugin
// hides it natively at activity start, but the system brings it back whenever
// the user swipes it in, the keyboard opens, or the app returns from the
// background — so re-hide it on those events to stay immersive.
//
// Behavior is `overlay-swipe` (set in app.json), meaning a swipe from the
// bottom edge shows the bar transiently over the content and the system hides
// it again on its own. iOS has no equivalent bar, so this is a no-op there.
function hide() {
  NavigationBar.setVisibilityAsync("hidden").catch(() => {
    // The bar isn't controllable on some OEM builds — ignore and move on.
  });
}

export default function ImmersiveMode() {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    hide();

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") hide();
    });
    const keyboard = Keyboard.addListener("keyboardDidHide", hide);

    return () => {
      appState.remove();
      keyboard.remove();
    };
  }, []);

  return null;
}
