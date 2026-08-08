/* ═══════════════════════════════════════════════════════════════════════════
   La Ménagère Paris — définition du questionnaire de cadrage.

   Source unique partagée par index.html (le questionnaire envoyé au prospect)
   et reponses.html (la console de consultation). Toute modification de libellé,
   d'ordre ou de tarif se fait ici, et les deux pages suivent.

   Tout tient dans la première question : page de présentation animée,
   plateforme web, ou les deux. C'est la seule décision qui change le projet ;
   les sept suivantes ne font qu’en préciser le périmètre.

   Le questionnaire ne demande PAS comment mettre l'application en scène ni quel
   niveau d'animation : le prototype a été montré et validé, c'est notre affaire.

   Les options des parties B à D reprennent ce que fait déjà l'application
   mobile (features/ : auth, cart, favorites, search, promo, orders, addresses,
   messaging, tickets, reviews, quotes), puisque le site en est le portage web.

   Les montants sont en euros HT. Le total = SOCLE + la somme des prix retenus ;
   les lignes portant `m` sont mensuelles et comptées à part.
   Calibrage : SOCLE + toutes les options les plus chères = 1 900 € pile.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Montants en euros HT. C'est le seul endroit à retoucher pour ajuster le devis :
   chaque option porte son prix, le total est leur somme + SOCLE.            */
const SOCLE = 400;       // direction artistique, intégration responsive, mise en ligne
const CURRENCY = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

/**
 * Le questionnaire envoyé au prospect n'affiche aucun montant : il choisit un
 * périmètre, le chiffrage arrive après, dans une proposition à part. Les prix
 * restent calculés et enregistrés — la console (reponses.html) les montre
 * toujours, elle. Passer à true pour les afficher aussi dans le formulaire.
 */
const SHOW_PRICES = false;

const SECTIONS = [
  {id:'A',title:'Le projet',lead:'La décision de fond, et ce que la page doit raconter de vous.'},
  {id:'B',title:'Le compte et le catalogue',lead:'Ce que le site reprend de votre application et de votre back-office.'},
  {id:'C',title:'Commander et suivre',lead:'Payer, puis savoir où en est sa commande.'},
  {id:'D',title:'Le client',lead:'Ce qu’il retrouve chez vous, et comment il vous parle.'}
];

const QUESTIONS = [
/* ── A · Le projet ─────────────────────────────────────────────────────── */
{k:'q1',s:'A',t:'Qu’attendez-vous exactement de ce site ?',
 why:'C’est la seule décision qui change vraiment le projet. Tout le reste du questionnaire n’en est que le détail.',
 type:'single',def:'deux',
 o:[
  {v:'landing',l:'Une page de présentation animée',
   d:'Une seule page, vivante, qui raconte la maison et met votre application en avant. Le visiteur vous découvre, puis télécharge.',p:320},
  {v:'plateforme',l:'Une plateforme web, comme votre application',
   d:'Tout ce que fait l’application, dans un navigateur : catalogue, panier, commande, compte client. Sans rien installer.',p:430},
  {v:'deux',l:'Les deux',
   d:'La page de présentation en vitrine, la plateforme derrière. Le visiteur choisit : télécharger l’application, ou commander tout de suite depuis son ordinateur.',p:600,tag:'Recommandé'}
 ]},
{k:'q2',s:'A',t:'Que doit-on montrer de la maison ?',
 why:'On n’achète pas un meuble sur-mesure à un inconnu. Ces sections sont ce qui transforme un visiteur curieux en client qui vous fait confiance — et vous êtes le seul à pouvoir nous dire ce qu’il y a à raconter.',
 type:'multi',def:['savoirfaire','galerie','chiffres','avis'],
 o:[
  {v:'savoirfaire',l:'Le savoir-faire et l’atelier',d:'Comment vos meubles sont faits, et par qui.',p:50,tag:'Recommandé'},
  {v:'galerie',l:'Galerie de réalisations',d:'Vos plus belles poses, en grand.',p:70},
  {v:'chiffres',l:'Chiffres clés',d:'Années d’expérience, meubles posés, clients — qui se comptent sous les yeux du visiteur.',p:35},
  {v:'avis',l:'Avis clients',p:40},
  {v:'showroom',l:'Le showroom, les horaires et le plan d’accès',p:30}
 ]},

/* ── B · Le compte et le catalogue ─────────────────────────────────────── */
{k:'q3',s:'B',t:'Le site et l’application partagent-ils le même compte ?',
 why:'Il commence sur son téléphone dans le métro, il termine sur son ordinateur le soir. Sans compte partagé, il recommence de zéro et il abandonne.',
 type:'multi',def:['identifiants','panier','social'],
 o:[
  {v:'identifiants',l:'Les mêmes identifiants des deux côtés',d:'Un seul compte, une seule inscription.',p:45,tag:'Recommandé'},
  {v:'panier',l:'Panier et favoris retrouvés d’un appareil à l’autre',p:35},
  {v:'social',l:'Connexion Google et Apple',d:'Déjà en place dans l’application.',p:20}
 ]},
{k:'q4',s:'B',t:'Le catalogue et les offres sur le site',
 why:'Un visiteur qui ne trouve pas en trois clics repart. Codes promo et bannières existent déjà dans votre back-office : il n’y a qu’à les brancher.',
 type:'multi',def:['sync','categories','recherche','filtres','favoris','codes','bannieres'],
 o:[
  {v:'sync',l:'Produits synchronisés avec votre back-office',d:'Une seule saisie, jamais d’écart de prix ni de stock.',p:40,tag:'Recommandé'},
  {v:'categories',l:'Navigation par catégories',d:'Compris dans le socle.',p:0},
  {v:'recherche',l:'Barre de recherche',p:35},
  {v:'filtres',l:'Filtres et tri',d:'Par prix, par dimension, par nouveauté.',p:25},
  {v:'favoris',l:'Mise en favori',d:'Il garde ses coups de cœur et revient les chercher.',p:20},
  {v:'codes',l:'Codes de réduction au panier',p:25,tag:'Déjà en place',have:true},
  {v:'bannieres',l:'Bannières et pop-up promotionnels',p:15,tag:'Déjà en place',have:true}
 ]},

/* ── C · Commander et suivre ───────────────────────────────────────────── */
{k:'q5',s:'C',t:'Comment vos clients paient-ils ?',
 why:'Apple Pay et Google Pay divisent par deux les abandons sur téléphone : trois secondes au lieu de sortir sa carte et de la saisir.',
 type:'multi',def:['cb','wallet','paypal'],
 o:[
  {v:'cb',l:'Carte bancaire',d:'Votre compte Stripe existe déjà : on le réutilise, il n’y a que le branchement à faire.',p:80,tag:'Recommandé'},
  {v:'wallet',l:'Apple Pay et Google Pay',d:'Le client paie d’une empreinte, sans rien taper.',p:20},
  {v:'paypal',l:'PayPal',p:20}
 ]},
{k:'q6',s:'C',t:'Le suivi de la commande et du colis',
 why:'« Où en est ma commande ? » est la première question posée après un achat. Si le site n’y répond pas, c’est vous qu’on appelle.',
 type:'multi',def:['statut','numero','emails','notif'],
 o:[
  {v:'statut',l:'Voir l’état de sa commande en ligne',d:'Confirmée, en préparation, expédiée, livrée.',p:35,tag:'Recommandé'},
  {v:'numero',l:'Numéro de suivi du transporteur, cliquable',p:20},
  {v:'emails',l:'E-mail à chaque étape',d:'Envoyé tout seul, sans que vous y pensiez.',p:25},
  {v:'notif',l:'Notification dès que le colis part',p:15}
 ]},

/* ── D · Le client ─────────────────────────────────────────────────────── */
{k:'q7',s:'D',t:'Son espace personnel et le service après-vente',
 why:'Un client qui retrouve tout son historique commande une deuxième fois sans réfléchir. Et une réclamation traitée dans le site ne devient pas un avis à une étoile.',
 type:'multi',def:['historique','adresses','messagerie','reclamations'],
 o:[
  {v:'historique',l:'Historique des commandes et factures',p:35,tag:'Recommandé'},
  {v:'adresses',l:'Carnet d’adresses enregistrées',d:'Il ne ressaisit jamais deux fois la même chose.',p:20},
  {v:'messagerie',l:'Messagerie avec vous',d:'Il écrit depuis le site, vous répondez depuis votre back-office.',p:40},
  {v:'reclamations',l:'Réclamations et suivi des demandes',p:25}
 ]},
{k:'q8',s:'D',t:'Les demandes de sur-mesure',
 why:'Le client mesure, photographie et envoie. Vous n’avez plus qu’à chiffrer, sans échanger dix messages.',
 type:'multi',def:['photos','dimensions','confirmation'],
 o:[
  {v:'photos',l:'Formulaire avec envoi de photos',p:30,tag:'Recommandé'},
  {v:'dimensions',l:'Choix des dimensions et de l’ouverture',d:'Comme dans votre application.',p:35},
  {v:'confirmation',l:'Réponse automatique de confirmation',d:'Personne ne reste sans nouvelles.',p:15}
 ]},

];

/* Les trois formules : un clic remplit l'ensemble du questionnaire. */
const TIERS = {
  presentation:{name:'Présentation',line:'La page qui vous présente',
    bullets:['Page de présentation animée','L’application mise en avant','Savoir-faire, galerie et avis','Formulaire de devis'],
    a:{q1:'landing',q2:['savoirfaire','galerie','avis'],q3:[],q4:['categories'],q5:[],q6:[],q7:[],
       q8:['photos']}},
  plateforme:{name:'Plateforme',line:'Votre application, dans un navigateur',
    bullets:['Catalogue, panier et paiement','Compte partagé app et web','Recherche et filtres','Suivi de commande','Espace personnel'],
    a:{q1:'plateforme',q2:['savoirfaire','galerie'],q3:['identifiants'],
       q4:['sync','categories','recherche','filtres','codes'],q5:['cb','wallet'],
       q6:['statut','numero'],q7:['historique','adresses'],q8:['photos']}},
  /* `hot` = la formule mise en avant, marquée « le plus choisi ». */
  complet:{name:'Complet',hot:true,line:'La présentation et la plateforme',
    bullets:['La page de présentation animée','Et toute la plateforme derrière','Compte partagé app et web','Suivi de colis par e-mail et notification','Messagerie et SAV','Sur-mesure en ligne'],
    a:{q1:'deux',q2:['savoirfaire','galerie','chiffres','avis','showroom'],
       q3:['identifiants','panier','social'],
       q4:['sync','categories','recherche','filtres','favoris','codes','bannieres'],
       q5:['cb','wallet','paypal'],q6:['statut','numero','emails','notif'],
       q7:['historique','adresses','messagerie','reclamations'],
       q8:['photos','dimensions','confirmation']}}
};

/* ═══════════════════════════════════════════════════════════════════════════
   Utilitaires de chiffrage — partagés par les deux pages
   ═══════════════════════════════════════════════════════════════════════════ */
const optOf = (q,v) => q.o.find(o => o.v === v);
const questionOf = k => QUESTIONS.find(q => q.k === k);

/**
 * Empreinte de la définition courante. Sert de suffixe au cache local : dès que
 * les questions changent, les brouillons d'une version précédente sont ignorés
 * au lieu de repeupler le formulaire avec des réponses qui n'existent plus.
 */
const DEF_HASH = QUESTIONS.map(q => q.k + q.o.map(o => o.v).join('')).join('|')
  .split('').reduce((h,c) => (h * 31 + c.charCodeAt(0)) | 0, 7).toString(36);

/**
 * Ne conserve d'un jeu de réponses que ce que la définition actuelle connaît.
 * Une valeur inconnue laisse la question sur son défaut plutôt que sur du vide.
 */
function adoptAnswers(target,source){
  if(!source) return target;
  QUESTIONS.forEach(q => {
    const a = source[q.k];
    if(a == null) return;
    if(q.type === 'multi'){
      if(!Array.isArray(a)) return;
      const kept = a.filter(v => optOf(q,v));
      if(!a.length || kept.length) target[q.k] = kept;   // [] volontaire = respecté
    }else if(optOf(q,a)){
      target[q.k] = a;
    }
  });
  return target;
}

/** Total d'un jeu de réponses quelconque — sert aussi au chiffrage des formules. */
function totalOf(answers){
  let sum = SOCLE;
  QUESTIONS.forEach(q => {
    const a = answers[q.k];
    if(a == null) return;
    (Array.isArray(a) ? a : [a]).forEach(v => {sum += optOf(q,v)?.p || 0;});
  });
  return sum;
}

/** Part récurrente (suivi, hébergement), en euros par mois. */
function monthlyOf(answers){
  let m = 0;
  QUESTIONS.forEach(q => {
    const a = answers[q.k];
    if(a == null) return;
    (Array.isArray(a) ? a : [a]).forEach(v => {m += optOf(q,v)?.m || 0;});
  });
  return m;
}
