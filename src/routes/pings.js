const { Router } = require('express');
const store = require('../data/store');

const router = Router();

router.get('/', (req, res) => {
  let pings = store.list('pings');

  if (req.query.vehicle_id) {
    pings = pings.filter(p => String(p.vehicle_id) === req.query.vehicle_id);
  }
  if (req.query.from) {
    pings = pings.filter(p => new Date(p.timestamp) >= new Date(req.query.from));
  }
  if (req.query.to) {
    pings = pings.filter(p => new Date(p.timestamp) <= new Date(req.query.to));
  }

  pings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (req.query.limit) {
    pings = pings.slice(0, Number(req.query.limit));
  }

  res.json({ data: pings, count: pings.length });
});

router.post('/', (req, res) => {
  const { vehicle_id, latitude, longitude, timestamp } = req.body;
  if (vehicle_id === undefined || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: { code: 400, message: 'vehicle_id, latitude, and longitude are required' },
    });
  }

  const vehicle = store.getById('vehicles', vehicle_id);
  if (!vehicle) {
    return res.status(400).json({ error: { code: 400, message: 'vehicle_id does not exist' } });
  }

  const ping = store.create('pings', {
    vehicle_id: Number(vehicle_id),
    latitude: Number(latitude),
    longitude: Number(longitude),
    timestamp: timestamp || new Date().toISOString(),
  });

  res.status(201).json({ data: ping });
});

module.exports = router;
