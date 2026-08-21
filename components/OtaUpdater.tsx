import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/**
 * Au démarrage, expo-updates cherche déjà une mise à jour tout seul et
 * l'installe au lancement *suivant* (fallbackToCacheTimeout: 0 — on ne bloque
 * jamais le splash sur le réseau). Ça suffit pour qui ferme l'app, mais une
 * app qui reste des jours en arrière-plan ne redémarre jamais vraiment : ce
 * composant rattrape ce cas au retour au premier plan.
 */

/**
 * Au-delà de ce temps passé en arrière-plan, on considère que l'utilisateur
 * revient sur une nouvelle session : recharger est indolore.
 *
 * En dessous, on se contente de télécharger. C'est volontairement long, parce
 * qu'un aller-retour court, c'est typiquement l'app bancaire du 3D Secure ou
 * le navigateur Stripe — recharger là-dedans ferait perdre le paiement en
 * cours. La mise à jour téléchargée s'appliquera au prochain lancement.
 */
const RELOAD_AFTER_BACKGROUND_MS = 15 * 60 * 1000;

async function fetchAndMaybeReload(backgroundedForMs: number) {
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return;
    await Updates.fetchUpdateAsync();
    if (backgroundedForMs >= RELOAD_AFTER_BACKGROUND_MS) {
      await Updates.reloadAsync();
    }
  } catch {
    // Hors ligne, serveur injoignable, mise à jour corrompue : on garde le
    // bundle actuel et on retentera au prochain retour au premier plan.
  }
}

export default function OtaUpdater() {
  // Renseigné uniquement quand on part en arrière-plan, donc null au tout
  // premier "active" — ce que le check de démarrage couvre déjà.
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    // Faux en dev et dans le dev client : rien à mettre à jour, et
    // reloadAsync() jetterait le bundle Metro.
    if (!Updates.isEnabled) return;

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        backgroundedAt.current ??= Date.now();
        return;
      }
      if (state !== "active") return;
      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (since === null) return;
      void fetchAndMaybeReload(Date.now() - since);
    });

    return () => sub.remove();
  }, []);

  return null;
}
