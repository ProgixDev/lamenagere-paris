-- Backfill the business's own legal identity into the settings singleton —
-- previously only store_name/contact_email were set, leaving phone/address/
-- SIRET null even though they're needed on every invoice (see invoices,
-- 0041). Values match what's already printed on the business's real invoices.
-- contact_email is untouched: it's already configured and editable from the
-- admin settings screen — this only fills in what was empty.
UPDATE settings SET
  contact_phone = COALESCE(contact_phone, '+33 7 82 41 68 80'),
  warehouse_address = COALESCE(warehouse_address, '66 avenue des Champs-Élysées, 75008 Paris, France'),
  siret = COALESCE(siret, '888 477 429')
WHERE id = 1;
