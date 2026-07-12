const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/', (req, res) => {
  const keys = store.list('apiKeys');
  res.json({ data: keys.map(k => ({ id: k.id, name: k.name, key: k.key, created_at: k.created_at })) });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: { code: 400, message: 'name is required' } });
  }
  const apiKey = store.generateApiKey(name);
  res.status(201).json({ data: apiKey });
});

router.delete('/:id', (req, res) => {
  const deleted = store.delete('apiKeys', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: { code: 404, message: 'API key not found' } });
  }
  res.status(204).end();
});

module.exports = router;
