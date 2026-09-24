function authAdmin(req, res, next) {
  const cleFournie = req.headers['x-admin-key'];
  const cleAttendue = process.env.ADMIN_API_KEY;

  if (!cleAttendue) {
    console.warn('ADMIN_API_KEY non configurée côté serveur - routes admin non protégées !');
    return res.status(500).json({ erreur: 'Configuration serveur incomplète.' });
  }

  if (!cleFournie || cleFournie !== cleAttendue) {
    return res.status(401).json({ erreur: 'Non autorisé.' });
  }

  next();
}

module.exports = { authAdmin };
