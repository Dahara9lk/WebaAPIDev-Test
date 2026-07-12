const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/', (req, res) => {
  const filters = {};
  if (req.query.station_id) filters.station_id = req.query.station_id;
  if (req.query.status) filters.status = req.query.status;
  const vehicles = store.list('vehicles', filters);
  const result = vehicles.map(v => {
    const station = store.getById('stations', v.station_id);
    return { ...v, station_name: station ? station.name : null };
  });
  res.json({ data: result, count: result.length });
});

router.get('/:id', (req, res) => {
  const vehicle = store.getVehicleWithLocation(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: { code: 404, message: 'Vehicle not found' } });
  }
  res.json({ data: vehicle });
});

router.post('/', (req, res) => {
  const { registration_number, device_id, station_id, status } = req.body;
  if (!registration_number || !device_id || !station_id) {
    return res.status(400).json({
      error: { code: 400, message: 'registration_number, device_id, and station_id are required' },
    });
  }
  const station = store.getById('stations', station_id);
  if (!station) {
    return res.status(400).json({ error: { code: 400, message: 'station_id does not exist' } });
  }
  const vehicle = store.create('vehicles', {
    registration_number,
    device_id,
    station_id: Number(station_id),
    status: status || 'active',
  });
  res.status(201).json({ data: { ...vehicle, station_name: station.name } });
});

router.put('/:id', (req, res) => {
  const allowed = ['registration_number', 'device_id', 'station_id', 'status'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const vehicle = store.update('vehicles', req.params.id, updates);
  if (!vehicle) {
    return res.status(404).json({ error: { code: 404, message: 'Vehicle not found' } });
  }
  const station = store.getById('stations', vehicle.station_id);
  res.json({ data: { ...vehicle, station_name: station ? station.name : null } });
});

router.delete('/:id', (req, res) => {
  const deleted = store.delete('vehicles', req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: { code: 404, message: 'Vehicle not found' } });
  }
  res.status(204).end();
});

router.get('/:id/pings', (req, res) => {
  const vehicle = store.getById('vehicles', req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: { code: 404, message: 'Vehicle not found' } });
  }
  let pings = store.list('pings', { vehicle_id: req.params.id });
  if (req.query.from) {
    pings = pings.filter(p => new Date(p.timestamp) >= new Date(req.query.from));
  }
  if (req.query.to) {
    pings = pings.filter(p => new Date(p.timestamp) <= new Date(req.query.to));
  }
  if (req.query.limit) {
    pings = pings.slice(0, Number(req.query.limit));
  }
  pings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json({ data: pings, count: pings.length });
});

router.get('/:id/current-location', (req, res) => {
  const vehicle = store.getById('vehicles', req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: { code: 404, message: 'Vehicle not found' } });
  }
  const pings = store.list('pings', { vehicle_id: req.params.id });
  const latest = pings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  if (!latest) {
    return res.json({ data: { vehicle_id: Number(req.params.id), location: null } });
  }
  res.json({
    data: {
      vehicle_id: Number(req.params.id),
      latitude: latest.latitude,
      longitude: latest.longitude,
      timestamp: latest.timestamp,
    },
  });
});

router.get('/:id/trips', (req, res) => {
  const vehicle = store.getById('vehicles', req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: { code: 404, message: 'Vehicle not found' } });
  }
  let trips = store.list('trips', { vehicle_id: req.params.id });
  trips = trips.map(t => {
    const driver = store.getById('drivers', t.driver_id);
    return { ...t, registration_number: vehicle.registration_number, driver_name: driver ? driver.name : null };
  });
  trips.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  res.json({ data: trips, count: trips.length });
});

module.exports = router;
