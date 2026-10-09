const axios = require('axios');

const BASE_URL = process.env.FEDAPAY_BASE_URL || 'https://sandbox-api.fedapay.com/v1';
const CLE = process.env.FEDAPAY_SECRET_KEY;
// Taux approximatif pour les tests : à régler avec la variable TAUX_USD_XOF avant le vrai lancement
const TAUX_USD_XOF = Number(process.env.TAUX_USD_XOF || 600);

function chiffres(tel) {
  let t = String(tel || '').replace(/\D/g, '');
  if (t.startsWith('229') && t.length > 8) t = t.slice(3);
  return t;
}

async function declencherPayout({ montantUsd, telephone, reference }) {
  const numero = chiffres(telephone);
  if (numero.length < 8) throw new Error('Numéro MoMo invalide.');

  const montantXof = Math.round(Number(montantUsd) * TAUX_USD_XOF);
  const entetes = {
    Authorization: `Bearer ${CLE}`,
    'Content-Type': 'application/json',
  };

  try {
    const creation = await axios.post(
      `${BASE_URL}/payouts`,
      {
        amount: montantXof,
        currency: { iso: 'XOF' },
        mode: 'mtn_open',
        description: `Paiement carte cadeau ${reference}`,
        customer: {
          firstname: 'Client',
          lastname: 'CardX',
          email: `client${numero}@example.com`,
          phone_number: { number: `+229${numero}`, country: 'bj' },
        },
      },
      { headers: entetes }
    );

    const brut = creation.data;
    const payout = brut['v1/payout'] || brut.payout || brut;
    if (!payout || !payout.id) {
      throw new Error('Réponse inattendue : ' + JSON.stringify(brut).slice(0, 200));
    }

    await axios.put(
      `${BASE_URL}/payouts/start`,
      { payouts: [{ id: payout.id }] },
      { headers: entetes }
    );

    return { reference: String(payout.id), montantXof };
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data).slice(0, 300) : err.message;
    throw new Error('FedaPay : ' + detail);
  }
}

module.exports = { declencherPayout };
