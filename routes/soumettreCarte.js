const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { declencherPayout } = require('../services/fedapay');
const { authAdmin } = require('../middleware/authAdmin');

const GRILLE_TAUX = {
  apple: 0.83,
  itunes: 0.83,
  amazon: 0.81,
  google_play: 0.76,
  steam: 0.72,
  autre: 0.60,
};

function ajustementMontant(montantFacial) {
  if (montantFacial >= 200) return 0.02;
  if (montantFacial < 20) return -0.05;
  return 0;
}

function calculerMontantPropose(typeCarte, montantFacial) {
  const tauxBase = GRILLE_TAUX[typeCarte] ?? GRILLE_TAUX.autre;
  const tauxBrut = Math.min(0.95, Math.max(0.3, tauxBase + ajustementMontant(montantFacial)));
  const taux = +tauxBrut.toFixed(3);
  const montantPropose = +(montantFacial * taux).toFixed(2);
  return { taux, montantPropose };
}

router.post('/soumettre-carte', async (req, res) => {
  try {
    const { utilisateurId, typeCarte, codeCarte, montantFacial, devise, moyenPaiement } = req.body;

    if (!utilisateurId || !typeCarte || !codeCarte || !montantFacial) {
      return res.status(400).json({ erreur: 'Champs manquants : utilisateurId, typeCarte, codeCarte, montantFacial sont requis.' });
    }
    if (montantFacial <= 0) {
      return res.status(400).json({ erreur: 'Le montant facial doit être positif.' });
    }

    const { taux, montantPropose } = calculerMontantPropose(typeCarte.toLowerCase(), Number(montantFacial));

    const soumissionId = uuidv4();

    await db.query(
      `INSERT INTO cartes_soumises
        (id, utilisateur_id, type_carte, code_carte, montant_facial, devise, taux_applique, montant_propose, moyen_paiement, statut, cree_le)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'en_attente_verification', NOW())`,
      [soumissionId, utilisateurId, typeCarte, codeCarte, montantFacial, devise || 'USD', taux, montantPropose, moyenPaiement || 'momo']
    );

    return res.status(201).json({
      soumissionId,
      montantPropose,
      taux,
      statut: 'en_attente_verification',
      message: 'Carte reçue. Vérification en cours, tu seras notifié une fois validée.',
    });
  } catch (err) {
    console.error('Erreur /soumettre-carte :', err);
    return res.status(500).json({ erreur: 'Erreur interne lors de la soumission.' });
  }
});

router.post('/soumissions/:id/valider', authAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { soldeReelConfirme } = req.body;

    const { rows } = await db.query('SELECT * FROM cartes_soumises WHERE id = $1', [id]);
    const soumission = rows[0];
    if (!soumission) return res.status(404).json({ erreur: 'Soumission introuvable.' });
    if (soumission.statut !== 'en_attente_verification') {
      return res.status(409).json({ erreur: `Statut actuel non valide pour validation : ${soumission.statut}` });
    }

    if (!soldeReelConfirme) {
      await db.query(`UPDATE cartes_soumises SET statut = 'rejetee' WHERE id = $1`, [id]);
      return res.json({ statut: 'rejetee' });
    }

    const payout = await declencherPayout({
      montant: soumission.montant_propose,
      utilisateurId: soumission.utilisateur_id,
      moyenPaiement: soumission.moyen_paiement,
    });

    await db.query(
      `UPDATE cartes_soumises SET statut = 'payee', payout_reference = $2 WHERE id = $1`,
      [id, payout.reference]
    );

    return res.json({ statut: 'payee', payoutReference: payout.reference });
  } catch (err) {
    console.error('Erreur /soumissions/:id/valider :', err);
    return res.status(500).json({ erreur: 'Erreur interne lors de la validation.' });
  }
});

module.exports = router;
