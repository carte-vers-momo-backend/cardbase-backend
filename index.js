require('dotenv').config();
const express = require('express');
const db = require('./db');
const app = express();

app.use(express.json());

app.use(express.static('public', { extensions: ['html'] }));

app.use('/', require('./routes/soumettreCarte'));
app.use('/', require('./routes/admin'));

app.get('/', (req, res) => {
  res.json({ statut: 'ok', service: 'cardbase-backend' });
});

async function initialiserBase() {
  await db.query(`
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
    )
  `);
  console.log('Table cartes_soumises prête.');
}

const PORT = process.env.PORT || 3000;

initialiserBase()
  .catch((err) => console.error('Erreur création table :', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
  });
