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
    const { utilisateurId, typeCarte, codeCarte, montantFacial, devise, moyenPaiement, telephone } = req.body;

    if (!utilisateurId || !typeCarte || !codeCarte || !montantFacial) {
      return res.status(400).json({ erreur: 'Champs manquants.' });
    }
    if (Number(montantFacial) <= 0) {
      return res.status(400).json({ erreur: 'Le montant doit être positif.' });
    }
    const chiffresTel = String(telephone || '').replace(/\D/g, '');
    if (chiffresTel.length < 8 || chiffresTel.length > 13) {
      return res.status(400).json({ erreur: 'Numéro MoMo invalide.' });
    }

    const { taux, montantPropose } = calculerMontantPropose(typeCarte.toLowerCase(), Number(montantFacial));
    const soumissionId = uuidv4();

    await db.query(
      `INSERT INTO cartes_soumises
        (id, utilisateur_id, type_carte, code_carte, montant_facial, devise, taux_applique, montant_propose, moyen_paiement, telephone, statut, cree_le)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'en_attente_verification', NOW())`,
      [soumissionId, utilisateurId, typeCarte, codeCarte, montantFacial, devise || 'USD', taux, montantPropose, moyenPaiement || 'momo', chiffresTel]
    );

    return res.status(201).json({
      soumissionId,
      montantPropose,
      taux,
      statut: 'en_attente_verification',
      message: 'Carte reçue. Vérification en cours.',
    });
  } catch (err) {
    console.error('Erreur /soumettre-carte :', err);
    return res.status(500).json({ erreur: 'Erreur interne lors de la soumission.' });
  }
});

router.post('/soumissions/:id/valider', authAdmin, async (req, res) => {
  const { id } = req.params;
  const { soldeReelConfirme } = req.body;

  try {
    if (!soldeReelConfirme) {
      const rejet = await db.query(
        `UPDATE cartes_soumises SET statut = 'rejetee', mis_a_jour_le = NOW()
         WHERE id = $1 AND statut = 'en_attente_verification' RETURNING id`,
        [id]
      );
      if (rejet.rows.length === 0) {
        return res.status(409).json({ erreur: 'Carte introuvable ou déjà traitée.' });
      }
      return res.json({ statut: 'rejetee' });
    }

    // Verrou : empêche de payer deux fois la même carte
    const verrou = await db.query(
      `UPDATE cartes_soumises SET statut = 'paiement_en_cours', mis_a_jour_le = NOW()
       WHERE id = $1 AND statut = 'en_attente_verification' RETURNING *`,
      [id]
    );
    const soumission = verrou.rows[0];
    if (!soumission) {
      return res.status(409).json({ erreur: 'Carte introuvable ou déjà traitée.' });
    }

    try {
      const payout = await declencherPayout({
        montantUsd: soumission.montant_propose,
        telephone: soumission.telephone,
        reference: id,
      });

      await db.query(
        `UPDATE cartes_soumises SET statut = 'payee', payout_reference = $2, mis_a_jour_le = NOW() WHERE id = $1`,
        [id, payout.reference]
      );
      return res.json({ statut: 'payee', payoutReference: payout.reference, montantXof: payout.montantXof });
    } catch (erreurPaiement) {
      await db.query(
        `UPDATE cartes_soumises SET statut = 'en_attente_verification', mis_a_jour_le = NOW() WHERE id = $1`,
        [id]
      );
      console.error('Paiement échoué :', erreurPaiement.message);
      return res.status(502).json({ erreur: erreurPaiement.message });
    }
  } catch (err) {
    console.error('Erreur /soumissions/:id/valider :', err);
    return res.status(500).json({ erreur: 'Erreur interne lors de la validation.' });
  }
});

module.exports = router;
