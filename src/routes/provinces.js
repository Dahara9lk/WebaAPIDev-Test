const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/', (req, res) => {
  const provinces = store.list('provinces');
  res.json({ data: provinces });
});

router.get('/:id', (req, res) => {
  const province = store.getById('provinces', req.params.id);
  if (!province) {
    return res.status(404).json({ error: { code: 404, message: 'Province not found' } });
  }
  res.json({ data: province });
});

router.get('/:id/districts', (req, res) => {
  const province = store.getById('provinces', req.params.id);
  if (!province) {
    return res.status(404).json({ error: { code: 404, message: 'Province not found' } });
  }
  const districts = store.list('districts', { province_id: req.params.id });
  res.json({ data: districts, count: districts.length });
});

module.exports = router;
