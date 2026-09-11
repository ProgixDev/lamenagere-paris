-- ═══════════════════════════════════════════════════════════════════════════
--  0047 — limiter le débit sur l'authentification
--
--  Pourquoi
--  ────────
--  `server/` n'a aucune limitation de débit, sauf `/leads` (limité à la main,
--  compté dans `website_leads`). `POST /auth/login`, `/auth/register` et
--  `/auth/forgot-password` sont donc ouverts sans plafond, sur un site qui
--  encaisse des paiements. Concrètement, aujourd'hui :
--
--   · un mot de passe se teste indéfiniment, à la vitesse du réseau ;
--   · des comptes se créent en masse ;
--   · `/auth/forgot-password` envoie un courriel par appel — une adresse peut
--     être inondée par un tiers, et le domaine d'envoi finit en liste noire.
--
--  L'application mobile vivait avec, parce qu'elle n'était pas une surface
--  publique indexée. La boutique en est une.
--
--  Pourquoi une table plutôt qu'un compteur en mémoire
--  ──────────────────────────────────────────────────
--  L'API tourne en fonctions serverless sur Vercel : chaque requête peut
--  atterrir sur une instance neuve, et la mémoire d'un processus ne compte donc
--  rien. Postgres est le seul état partagé, exactement le raisonnement que
--  `leads.service.ts` a déjà tenu.
--
--  Ce qui est stocké, et ce qui ne l'est pas
--  ────────────────────────────────────────
--  Ni adresse IP, ni adresse e-mail en clair : seulement leurs empreintes
--  salées (`hacherIp`, même sel `LEAD_IP_SALT`). Une empreinte répond à la
--  seule question posée — « combien d'échecs depuis cette connexion, sur ce
--  compte, dans les quinze dernières minutes » — sans constituer un registre
--  des tentatives de connexion de personnes identifiables.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE auth_attempts (
  id              bigserial PRIMARY KEY,
  -- sha256(ip || LEAD_IP_SALT). NULL quand l'adresse est introuvable : on ne
  -- limite alors que par identifiant, plutôt que de regrouper tout le monde
  -- sous une même clé nulle.
  ip_hash         text,
  -- sha256(email normalisé || LEAD_IP_SALT).
  identifier_hash text,
  -- 'login' | 'register' | 'forgot'. Les plafonds diffèrent par route.
  route           text NOT NULL,
  succeeded       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Les deux seules lectures : « échecs récents pour cette IP » et « échecs
-- récents pour ce compte ». `created_at DESC` parce que la fenêtre est toujours
-- un intervalle qui finit maintenant.
CREATE INDEX idx_auth_attempts_ip
  ON auth_attempts (ip_hash, route, created_at DESC)
  WHERE succeeded = false;

CREATE INDEX idx_auth_attempts_identifier
  ON auth_attempts (identifier_hash, route, created_at DESC)
  WHERE succeeded = false;

-- Le ménage : les lignes de plus de 24 h ne servent plus à aucune fenêtre.
-- Appelée au fil de l'eau par le service (une fois sur cinquante environ), il
-- n'y a pas d'ordonnanceur sur ce projet.
CREATE INDEX idx_auth_attempts_purge ON auth_attempts (created_at);

COMMENT ON TABLE auth_attempts IS
  'Salted-hash log of authentication attempts, used only for rate limiting. No raw IP or e-mail. See migration 0047.';

-- RLS active sans politique : l'API (service_role) est la seule source de
-- vérité, comme pour `website_leads` et `website_consents`.
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
