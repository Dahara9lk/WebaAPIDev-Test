const { Router } = require('express');
const store = require('../data/store');
const authorize = require('../middleware/authorize');

const router = Router();

router.get('/', (req, res) => {
  try {
    const filters = {};
    if (req.query.vehicle_id) filters.vehicle_id = req.query.vehicle_id;
    if (req.query.driver_id) filters.driver_id = req.query.driver_id;
    if (req.query.status) filters.status = req.query.status;

    let trips = store.list('trips', filters);

    if (req.query.from) {
      trips = trips.filter(t => new Date(t.start_time) >= new Date(req.query.from));
    }
    if (req.query.to) {
      trips = trips.filter(t => new Date(t.start_time) <= new Date(req.query.to));
    }

    trips = trips.map(t => {
      const vehicle = store.getById('vehicles', t.vehicle_id);
      const driver = store.getById('drivers', t.driver_id);
      return {
        ...t,
        registration_number: vehicle ? vehicle.registration_number : null,
        driver_name: driver ? driver.name : null,
      };
    });

    trips.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    res.json({ data: trips, count: trips.length });
  } catch (error) {
    console.error('❌ GET /trips error:', error);
    res.status(500).json({ error: { code: 500, message: error.message } });
  }
});

router.get('/:id', (req, res) => {
  try {
    const trip = store.getById('trips', req.params.id);
    if (!trip) {
      return res.status(404).json({ error: { code: 404, message: 'Trip not found' } });
    }
    const vehicle = store.getById('vehicles', trip.vehicle_id);
    const driver = store.getById('drivers', trip.driver_id);
    res.json({
      data: {
        ...trip,
        registration_number: vehicle ? vehicle.registration_number : null,
        driver_name: driver ? driver.name : null,
      },
    });
  } catch (error) {
    console.error('❌ GET /trips/:id error:', error);
    res.status(500).json({ error: { code: 500, message: error.message } });
  }
});

router.post('/', authorize('admin', 'dispatcher'), (req, res) => {
  try {
    console.log('📝 POST /trips - Request body:', req.body);
    
    const { vehicle_id, driver_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng } = req.body;

    if (!vehicle_id || !driver_id || !origin || !destination) {
      return res.status(400).json({
        error: { code: 400, message: 'vehicle_id, driver_id, origin, and destination are required' },
      });
    }

    console.log(`🔍 Looking for vehicle ID: ${vehicle_id}`);
    const vehicle = store.getById('vehicles', vehicle_id);
    console.log(`🔍 Vehicle found:`, vehicle ? 'YES' : 'NO');
    
    if (!vehicle) {
      return res.status(400).json({ error: { code: 400, message: 'vehicle_id does not exist' } });
    }

    console.log(`🔍 Looking for driver ID: ${driver_id}`);
    const driver = store.getById('drivers', driver_id);
    console.log(`🔍 Driver found:`, driver ? 'YES' : 'NO');
    console.log(`🔍 Driver status:`, driver ? driver.status : 'N/A');
    
    if (!driver) {
      return res.status(400).json({ error: { code: 400, message: 'driver_id does not exist' } });
    }

    if (driver.status === 'on_trip') {
      return res.status(409).json({ error: { code: 409, message: 'Driver is already on a trip' } });
    }

    if (vehicle.status !== 'active') {
      return res.status(409).json({ error: { code: 409, message: 'Vehicle is not active' } });
    }

    console.log('📝 Creating trip...');
    const trip = store.create('trips', {
      vehicle_id: Number(vehicle_id),
      driver_id: Number(driver_id),
      origin,
      destination,
      origin_lat: origin_lat !== undefined ? Number(origin_lat) : null,
      origin_lng: origin_lng !== undefined ? Number(origin_lng) : null,
      dest_lat: dest_lat !== undefined ? Number(dest_lat) : null,
      dest_lng: dest_lng !== undefined ? Number(dest_lng) : null,
      start_time: new Date().toISOString(),
      end_time: null,
      status: 'active',
    });
    console.log(`✅ Trip created with ID: ${trip.id}`);

    console.log(`📝 Updating driver ${driver_id} status to on_trip`);
    store.update('drivers', driver_id, { status: 'on_trip' });
    console.log(`✅ Driver status updated`);

    res.status(201).json({
      data: {
        ...trip,
        registration_number: vehicle.registration_number,
        driver_name: driver.name,
      },
    });
  } catch (error) {
    console.error('❌ POST /trips error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: { code: 500, message: error.message || 'Internal server error' } });
  }
});

router.patch('/:id/complete', authorize('admin', 'dispatcher'), (req, res) => {
  try {
    console.log(`📝 PATCH /trips/${req.params.id}/complete`);
    const trip = store.getById('trips', req.params.id);
    if (!trip) {
      return res.status(404).json({ error: { code: 404, message: 'Trip not found' } });
    }
    if (trip.status !== 'active') {
      return res.status(409).json({ error: { code: 409, message: `Trip is already ${trip.status}` } });
    }

    const updates = { status: 'completed', end_time: new Date().toISOString() };
    if (req.body.dest_lat !== undefined) updates.dest_lat = Number(req.body.dest_lat);
    if (req.body.dest_lng !== undefined) updates.dest_lng = Number(req.body.dest_lng);
    if (req.body.destination !== undefined) updates.destination = req.body.destination;
    if (req.body.end_time !== undefined) updates.end_time = req.body.end_time;

    const updated = store.update('trips', req.params.id, updates);
    store.update('drivers', trip.driver_id, { status: 'available' });

    const vehicle = store.getById('vehicles', updated.vehicle_id);
    const driver = store.getById('drivers', updated.driver_id);
    res.json({
      data: {
        ...updated,
        registration_number: vehicle ? vehicle.registration_number : null,
        driver_name: driver ? driver.name : null,
      },
    });
  } catch (error) {
    console.error('❌ PATCH /trips/complete error:', error);
    res.status(500).json({ error: { code: 500, message: error.message } });
  }
});

router.patch('/:id/cancel', authorize('admin', 'dispatcher'), (req, res) => {
  try {
    console.log(`📝 PATCH /trips/${req.params.id}/cancel`);
    const trip = store.getById('trips', req.params.id);
    if (!trip) {
      return res.status(404).json({ error: { code: 404, message: 'Trip not found' } });
    }
    if (trip.status !== 'active') {
      return res.status(409).json({ error: { code: 409, message: `Trip is already ${trip.status}` } });
    }

    const updated = store.update('trips', req.params.id, { status: 'cancelled', end_time: new Date().toISOString() });
    store.update('drivers', trip.driver_id, { status: 'available' });

    const vehicle = store.getById('vehicles', updated.vehicle_id);
    const driver = store.getById('drivers', updated.driver_id);
    res.json({
      data: {
        ...updated,
        registration_number: vehicle ? vehicle.registration_number : null,
        driver_name: driver ? driver.name : null,
      },
    });
  } catch (error) {
    console.error('❌ PATCH /trips/cancel error:', error);
    res.status(500).json({ error: { code: 500, message: error.message } });
  }
});

module.exports = router;