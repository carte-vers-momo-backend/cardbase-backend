require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.use('/', require('./routes/soumettreCarte'));
app.use('/', require('./routes/admin'));

app.get('/', (req, res) => {
  res.json({ statut: 'ok', service: 'cardbase-backend' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
