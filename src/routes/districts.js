const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/', (req, res) => {
  const filters = {};
  if (req.query.province_id) filters.province_id = req.query.province_id;
  const districts = store.list('districts', filters);
  res.json({ data: districts, count: districts.length });
});

router.get('/:id', (req, res) => {
  const district = store.getById('districts', req.params.id);
  if (!district) {
    return res.status(404).json({ error: { code: 404, message: 'District not found' } });
  }
  const province = store.getById('provinces', district.province_id);
  res.json({ data: { ...district, province_name: province ? province.name : null } });
});

router.get('/:id/stations', (req, res) => {
  const district = store.getById('districts', req.params.id);
  if (!district) {
    return res.status(404).json({ error: { code: 404, message: 'District not found' } });
  }
  const stations = store.list('stations', { district_id: req.params.id });
  res.json({ data: stations, count: stations.length });
});

module.exports = router;
