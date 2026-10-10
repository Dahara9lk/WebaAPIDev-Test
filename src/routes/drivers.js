const { Router } = require('express');
const store = require('../data/store');
const authorize = require('../middleware/authorize');

const router = Router();

router.get('/', (req, res) => {
  const filters = {};
  if (req.query.station_id) filters.station_id = req.query.station_id;
  if (req.query.status) filters.status = req.query.status;
  const drivers = store.list('drivers', filters);
  const result = drivers.map(d => {
    const station = store.getById('stations', d.station_id);
    return { ...d, station_name: station ? station.name : null };
  });
  res.json({ data: result, count: result.length });
});

router.get('/:id', (req, res) => {
  const driver = store.getById('drivers', req.params.id);
  if (!driver) {
    return res.status(404).json({ error: { code: 404, message: 'Driver not found' } });
  }
  const station = store.getById('stations', driver.station_id);
  res.json({ data: { ...driver, station_name: station ? station.name : null } });
});

router.post('/', authorize('admin'), (req, res) => {
  const { name, license_number, phone, station_id, status } = req.body;
  if (!name || !license_number || !station_id) {
    return res.status(400).json({
      error: { code: 400, message: 'name, license_number, and station_id are required' },
    });
  }
  const station = store.getById('stations', station_id);
  if (!station) {
    return res.status(400).json({ error: { code: 400, message: 'station_id does not exist' } });
  }
  const driver = store.create('drivers', {
    name,
    license_number,
    phone: phone || null,
    station_id: Number(station_id),
    status: status || 'available',
  });
  res.status(201).json({ data: { ...driver, station_name: station.name } });
});

router.put('/:id', authorize('admin'), (req, res) => {
  const allowed = ['name', 'license_number', 'phone', 'station_id', 'status'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const driver = store.update('drivers', req.params.id, updates);
  if (!driver) {
    return res.status(404).json({ error: { code: 404, message: 'Driver not found' } });
  }
  const station = store.getById('stations', driver.station_id);
  res.json({ data: { ...driver, station_name: station ? station.name : null } });
});

router.delete('/:id', authorize('admin'), (req, res) => {
  const deleted = store.delete('drivers', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: { code: 404, message: 'Driver not found' } });
  }
  res.status(204).end();
});

router.get('/:id/trips', (req, res) => {
  const driver = store.getById('drivers', req.params.id);
  if (!driver) {
    return res.status(404).json({ error: { code: 404, message: 'Driver not found' } });
  }
  let trips = store.list('trips', { driver_id: req.params.id });
  trips = trips.map(t => {
    const vehicle = store.getById('vehicles', t.vehicle_id);
    return {
      ...t,
      registration_number: vehicle ? vehicle.registration_number : null,
      driver_name: driver.name,
    };
  });
  trips.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  res.json({ data: trips, count: trips.length });
});

module.exports = router;
