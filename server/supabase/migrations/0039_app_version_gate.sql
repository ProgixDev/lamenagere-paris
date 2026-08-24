-- ── Verrou de version de l'app mobile (mise à jour forcée) ──────────────────
-- Quand une faille est corrigée dans une nouvelle version du store, on veut
-- pouvoir couper l'accès aux binaires vulnérables sans rien redéployer côté
-- app : l'admin relève la version minimale ici et les anciennes installations
-- se retrouvent bloquées sur un écran « Mise à jour requise » au lancement.
--
-- Le verrou est MANUEL et par plateforme, volontairement : une version publiée
-- sur le store n'est pas disponible pour tout le monde immédiatement (revue
-- App Store, déploiement progressif Play), donc forcer automatiquement dès
-- qu'une version apparaît enfermerait des utilisateurs dehors.
--
-- min_app_version_* est une version sémantique ("1.3.0") comparée à la version
-- du binaire installé. NULL = aucun minimum sur cette plateforme.
-- force_update_enabled est l'interrupteur général (coupe le verrou d'un clic).

ALTER TABLE settings
  ADD COLUMN force_update_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN min_app_version_ios     text,
  ADD COLUMN min_app_version_android text,
  ADD COLUMN ios_store_url           text,
  ADD COLUMN android_store_url       text,
  ADD COLUMN force_update_message    text;

UPDATE settings SET
  ios_store_url     = 'https://apps.apple.com/app/id6794943782',
  android_store_url = 'https://play.google.com/store/apps/details?id=com.progix.lamenagereparis'
WHERE id = 1;
