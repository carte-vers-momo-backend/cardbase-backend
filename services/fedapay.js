const axios = require('axios');

const FEDAPAY_BASE_URL = process.env.FEDAPAY_BASE_URL || 'https://sandbox-api.fedapay.com/v1';
const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;

async function declencherPayout({ montant, utilisateurId, moyenPaiement }) {
  const infosPaiement = await getInfosPaiementUtilisateur(utilisateurId);

  const response = await axios.post(
    `${FEDAPAY_BASE_URL}/payouts`,
    {
      amount: montant,
      currency: { iso: 'XOF' },
      mode: moyenPaiement === 'momo' ? 'mtn_open' : 'bank',
      customer: {
        firstname: infosPaiement.prenom,
        lastname: infosPaiement.nom,
        phone_number: {
          number: infosPaiement.telephone,
          country: 'BJ',
        },
      },
    },
    {
      headers: { Authorization: `Bearer ${FEDAPAY_SECRET_KEY}` },
    }
  );

  return { reference: response.data.payout.reference, brut: response.data };
}

async function getInfosPaiementUtilisateur(utilisateurId) {
  throw new Error('getInfosPaiementUtilisateur non implémentée - à connecter à ta base utilisateurs.');
}

module.exports = { declencherPayout };
