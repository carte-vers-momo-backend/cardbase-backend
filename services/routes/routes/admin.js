const express = require('express');
const router = express.Router();
const db = require('../db');
const { authAdmin } = require('../middleware/authAdmin');

router.use(authAdmin);

router.get('/admin/soumissions', async (req, res) => {
  try {
    const statut = req.query.statut || 'en_attente_verification';
    const { rows } = await db.query(
      `SELECT id, utilisateur_id, type_carte, montant_facial, devise, taux_applique,
              montant_propose, moyen_paiement, statut, cree_le
       FROM cartes_soumises
       WHERE statut = $1
       ORDER BY cree_le ASC`,
      [statut]
    );
    return res.json({ soumissions: rows });
  } catch (err) {
    console.error('Erreur /admin/soumissions :', err);
    return res.status(500).json({ erreur: 'Erreur interne.' });
  }
});

router.get('/admin/soumissions/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM cartes_soumises WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erreur: 'Soumission introuvable.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erreur /admin/soumissions/:id :', err);
    return res.status(500).json({ erreur: 'Erreur interne.' });
  }
});

router.get('/admin/stats', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE statut = 'payee') AS total_payees,
        COALESCE(SUM(montant_facial) FILTER (WHERE statut = 'payee'), 0) AS total_facial_paye,
        COALESCE(SUM(montant_propose) FILTER (WHERE statut = 'payee'), 0) AS total_verse_utilisateurs,
        COUNT(*) FILTER (WHERE statut = 'en_attente_verification') AS en_attente
      FROM cartes_soumises
    `);
    const stats = rows[0];
    const margeGeneree = (Number(stats.total_facial_paye) - Number(stats.total_verse_utilisateurs)).toFixed(2);
    return res.json({ ...stats, marge_generee_estimee: margeGeneree });
  } catch (err) {
    console.error('Erreur /admin/stats :', err);
    return res.status(500).json({ erreur: 'Erreur interne.' });
  }
});

module.exports = router;
