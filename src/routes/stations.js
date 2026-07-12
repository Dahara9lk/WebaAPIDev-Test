const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/', (req, res) => {
  const filters = {};
  if (req.query.district_id) filters.district_id = req.query.district_id;
  const stations = store.list('stations', filters);
  const result = stations.map(s => {
    const district = store.getById('districts', s.district_id);
    return { ...s, district_name: district ? district.name : null };
  });
  res.json({ data: result, count: result.length });
});

router.get('/:id', (req, res) => {
  const station = store.getById('stations', req.params.id);
  if (!station) {
    return res.status(404).json({ error: { code: 404, message: 'Station not found' } });
  }
  const district = store.getById('districts', station.district_id);
  res.json({ data: { ...station, district_name: district ? district.name : null } });
});

router.get('/:id/vehicles', (req, res) => {
  const station = store.getById('stations', req.params.id);
  if (!station) {
    return res.status(404).json({ error: { code: 404, message: 'Station not found' } });
  }
  const vehicles = store.list('vehicles', { station_id: req.params.id });
  res.json({ data: vehicles, count: vehicles.length });
});

router.get('/:id/drivers', (req, res) => {
  const station = store.getById('stations', req.params.id);
  if (!station) {
    return res.status(404).json({ error: { code: 404, message: 'Station not found' } });
  }
  const drivers = store.list('drivers', { station_id: req.params.id });
  res.json({ data: drivers, count: drivers.length });
});

module.exports = router;
