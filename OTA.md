# Mises à jour OTA (EAS Update)

Permet de pousser du JS/TS, des styles et des assets aux apps déjà installées,
sans repasser par l'App Store ni le Play Store.

## Publier

```bash
npm run ota           # canal production (les builds du store)
npm run ota:preview   # canal preview (les APK internes)
```

EAS demande un message de release, puis publie sur la branche. Les apps du
canal correspondant récupèrent la mise à jour au lancement suivant.

## Ce qui passe en OTA, et ce qui ne passe pas

Passe : écrans, composants, logique métier, textes, styles, images du dossier
`assets/`, appels API, corrections de bugs JS.

Ne passe **pas** — il faut un build + une soumission au store :
- ajout / suppression / mise à jour d'une dépendance native (`expo-*`,
  `@stripe/stripe-react-native`, etc.) ;
- changement dans `app.json` qui touche le natif : permissions, plugins,
  `scheme`, icône, splash, nom, package ;
- montée de version d'Expo SDK ou de React Native.

Pousser du JS qui appelle un module natif absent du build installé = crash au
démarrage chez l'utilisateur. En cas de doute : build.

## Le garde-fou : runtimeVersion

`app.json` utilise `"runtimeVersion": { "policy": "appVersion" }` : une mise à
jour OTA n'atteint que les builds dont le `version` d'`app.json` est identique.

Donc la règle de travail est simple :

- **correctif JS** → on ne touche pas à `version`, `npm run ota`, terminé ;
- **changement natif** → on incrémente `version` (1.1.0 → 1.2.0) *avant* le
  build. Les anciennes installations cessent alors de recevoir les OTA de la
  nouvelle version, ce qui est exactement ce qu'on veut.

Oublier ce bump est la seule vraie façon de se tirer une balle dans le pied :
les OTA partiraient vers des builds sans le natif correspondant.

## Comportement côté app

- Au lancement : expo-updates vérifie en arrière-plan et installe au lancement
  *suivant*. Le splash n'attend jamais le réseau (`fallbackToCacheTimeout: 0`).
- Au retour au premier plan : `components/OtaUpdater.tsx` re-vérifie. Après 15
  minutes ou plus en arrière-plan, il recharge l'app immédiatement ; en deçà il
  se contente de télécharger, pour ne jamais interrompre un 3D Secure ou un
  retour de paiement Stripe.

## Rollback

```bash
npx eas-cli update:rollback         # revient à la publication précédente
npx eas-cli update:list --branch production
```

Le rollback est lui-même une OTA : il part en quelques secondes.

## Prérequis

La première build contenant `expo-updates` doit passer par les stores. Les
versions déjà en production ne sont pas rattrapables en OTA — elles n'ont pas
le module.
