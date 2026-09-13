CREATE TABLE IF NOT EXISTS cartes_soumises (
  id UUID PRIMARY KEY,
  utilisateur_id UUID NOT NULL,
  type_carte VARCHAR(50) NOT NULL,
  code_carte TEXT NOT NULL,
  montant_facial NUMERIC(10,2) NOT NULL,
  devise VARCHAR(10) NOT NULL DEFAULT 'USD',
  taux_applique NUMERIC(4,3) NOT NULL,
  montant_propose NUMERIC(10,2) NOT NULL,
  moyen_paiement VARCHAR(20) NOT NULL DEFAULT 'momo',
  statut VARCHAR(30) NOT NULL DEFAULT 'en_attente_verification',
  payout_reference VARCHAR(100),
  cree_le TIMESTAMP NOT NULL DEFAULT NOW(),
  mis_a_jour_le TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cartes_soumises_statut ON cartes_soumises (statut);
CREATE INDEX IF NOT EXISTS idx_cartes_soumises_utilisateur ON cartes_soumises (utilisateur_id);
