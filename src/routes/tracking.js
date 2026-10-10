const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/dashboard', (req, res) => {
  const dashboard = store.getDashboard();
  res.json({ data: dashboard, count: dashboard.length });
});

module.exports = router;
