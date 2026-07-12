const express = require('express');
const auth = require('./src/middleware/auth');
const keysRouter = require('./src/routes/keys');
const provincesRouter = require('./src/routes/provinces');
const districtsRouter = require('./src/routes/districts');
const stationsRouter = require('./src/routes/stations');
const vehiclesRouter = require('./src/routes/vehicles');
const driversRouter = require('./src/routes/drivers');
const tripsRouter = require('./src/routes/trips');
const pingsRouter = require('./src/routes/pings');
const trackingRouter = require('./src/routes/tracking');

const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('<h1>TaxiCo Vehicle Tracking API</h1><p>See <a href="/api">/api</a> for available endpoints.</p>');
});

app.get('/api', (req, res) => {
  res.json({
    name: 'TaxiCo Vehicle Tracking API',
    version: '1.0.0',
    endpoints: {
      keys: '/api/keys',
      provinces: '/api/provinces',
      districts: '/api/districts',
      stations: '/api/stations',
      vehicles: '/api/vehicles',
      drivers: '/api/drivers',
      trips: '/api/trips',
      pings: '/api/pings',
      dashboard: '/api/tracking/dashboard',
    },
  });
});

app.use('/api/keys', auth, keysRouter);
app.use('/api/provinces', auth, provincesRouter);
app.use('/api/districts', auth, districtsRouter);
app.use('/api/stations', auth, stationsRouter);
app.use('/api/vehicles', auth, vehiclesRouter);
app.use('/api/drivers', auth, driversRouter);
app.use('/api/trips', auth, tripsRouter);
app.use('/api/pings', auth, pingsRouter);
app.use('/api/tracking', auth, trackingRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: { code: 500, message: 'Internal server error' } });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
