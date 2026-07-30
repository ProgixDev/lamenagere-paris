# Questionnaire de cadrage web

Deux pages statiques autonomes, adossées à l'API NestJS existante.

| Fichier | Pour qui | Rôle |
|---|---|---|
| `index.html` | le prospect | Le questionnaire : 20 questions, 3 formules, estimation en direct, sauvegarde automatique |
| `reponses.html` | vous | La console : liste des questionnaires, réponses, déroulé, notes internes |
| `questionnaire.js` | les deux | **Source unique** des libellés, options et tarifs |

## Les prix ne sont pas montrés au prospect

`SHOW_PRICES = false` dans `questionnaire.js` : le questionnaire n'affiche **aucun
montant**. Le prospect construit un périmètre, le récapitulatif compte les éléments
retenus, et le chiffrage arrive après dans une proposition à part.

Les prix continuent d'être calculés et enregistrés — la console `reponses.html` les
affiche toujours, ligne par ligne, et le total est stocké dans `estimated_total_cents`.
Passer la constante à `true` les fait réapparaître dans le formulaire.

## Ajuster les tarifs

Tout est dans `questionnaire.js` :

- `SOCLE` — le forfait de base (design des pages, intégration, mise en ligne) ;
- le champ `p` de chaque option — son prix en euros HT ;
- le champ `m` — la part mensuelle (suivi, hébergement) ;
- `TIERS` — le contenu des formules Essentiel / Boutique / Complet, dont le prix
  affiché est calculé automatiquement à partir des options qu'elles cochent.
  `hot:true` désigne celle qui porte le bandeau « le plus choisi ».

Calibrage actuel — **plafond à 1 900 € HT**, tout coché :

| | Montant |
|---|---|
| Socle | 400 € |
| Présentation | 910 € |
| Plateforme | 1 360 € |
| **Complet** | **1 900 €** |
| À l'ouverture (tout pré-coché) | 1 870 € |

Huit questions en quatre parties. **Tout tient dans la question 1** — page de
présentation animée, plateforme web, ou les deux : c'est la seule décision qui
change le projet, et elle pèse à elle seule 40 % du budget des options. Les sept
suivantes n'en précisent que le périmètre.

| | Partie | Questions |
|---|---|---|
| **A** | **Le projet** | **Ce qu'on attend du site** · ce qu'on montre de la maison |
| B | Le compte et le catalogue | Compte partagé app/web · catalogue et offres |
| C | Commander et suivre | Paiement · suivi du colis |
| D | Le client | Espace personnel et SAV · sur-mesure |

Les trois formules sont affichées **juste après la question 1**, dont elles
reprennent les trois réponses possibles : un clic remplit tout le reste.

Le bouton **« Valider mon périmètre » est en bas du fil**, dans un bloc de clôture,
et non dans le panneau latéral — dans le rail il passait sous le pli sur un petit
écran. Le panneau latéral ne porte plus que le décompte et la liste.

Il n'y a plus de partie « Après la mise en ligne » : le modèle n'a donc plus de
part mensuelle. `monthlyOf()` reste en place et renvoie 0 — il suffit d'ajouter un
`m:` sur une option pour la réactiver.

Le questionnaire ne demande **pas** comment mettre l'application en scène ni quel
niveau d'animation : le prototype a été montré et validé, c'est notre affaire.

Il n'y a **pas de bloc de coordonnées** : le brief est créé depuis la console avec
le nom du prospect, inutile de le lui redemander. « Valider mon périmètre » est
donc actif dès l'ouverture.

### Vérifier le rendu en local

```bash
# terminal 1 — l'API
cd server && PORT=3334 npm run start:dev
# terminal 2 — les pages
cd web/brief && python3 -m http.server 4599
```

Puis ouvrir `http://localhost:4599/index.html?api=http://localhost:3334`
(sans `slug`/`t`, la page tourne en mode démonstration et n'enregistre rien).

Les options des parties B à E reprennent ce que fait déjà l'application mobile
(`features/` : `auth`, `cart`, `favorites`, `search`, `promo`, `orders`,
`addresses`, `messaging`, `tickets`, `reviews`, `quotes`), puisque le site en est
le portage web.

Ces montants ne sont visibles que dans la console. Pour vérifier le plafond après
une modification :

```bash
node -e "const fs=require('fs');const {TIERS,QUESTIONS,CURRENCY,totalOf}=new Function(fs.readFileSync('questionnaire.js','utf8')+';return {TIERS,QUESTIONS,CURRENCY,totalOf};')();
const max={};QUESTIONS.forEach(q=>max[q.k]=q.type==='multi'?q.o.map(o=>o.v):q.o.reduce((a,b)=>b.p>(a?.p??-1)?b:a).v);
console.log('maximum :',CURRENCY.format(totalOf(max)));"
```

Le champ `def` d'une question fixe ce qui est pré-coché à l'ouverture.
Le drapeau `later:true` sur une option la classe en « plus tard » plutôt qu'en refus.

Modifier les questions est sans danger pour un questionnaire déjà envoyé : les
réponses sont filtrées par `adoptAnswers()` et le cache local est indexé sur
`DEF_HASH`, donc une réponse devenue inexistante retombe sur le défaut au lieu de
laisser la question vide.

## Envoyer un questionnaire

1. Ouvrir `reponses.html`, saisir la clé `BRIEF_OWNER_KEY`.
2. « Nouveau questionnaire » → nom du prospect → le lien est copié dans le presse-papiers.
3. Envoyer ce lien. La console montre en direct où il en est ; elle se rafraîchit toute seule.

## Déploiement

Projet Vercel **statique séparé**, racine `web/brief/`. Aucune construction, aucune
dépendance. `API_BASE` pointe automatiquement sur `https://lamenagere-paris.vercel.app`
en production et sur `http://localhost:3333` en local ; `?api=…` permet de forcer.

Côté serveur, la variable `BRIEF_OWNER_KEY` doit être définie dans l'environnement
Vercel de l'API — sans elle, les routes de la console refusent tout.
