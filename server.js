require('dotenv').config();

const express = require('express');
const authenticate = require('./src/middleware/authenticate');
const authorize = require('./src/middleware/authorize');
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
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('<h1>TaxiCo Vehicle Tracking API</h1><p>See <a href="/api">/api</a> for available endpoints.</p>');
});

app.get('/api', (req, res) => {
  res.json({
    name: 'TaxiCo Vehicle Tracking API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
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

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/keys', authenticate, authorize('admin'), keysRouter);
app.use('/api/provinces', authenticate, provincesRouter);
app.use('/api/districts', authenticate, districtsRouter);
app.use('/api/stations', authenticate, stationsRouter);
app.use('/api/vehicles', authenticate, vehiclesRouter);
app.use('/api/drivers', authenticate, driversRouter);
app.use('/api/trips', authenticate, tripsRouter);
app.use('/api/pings', authenticate, pingsRouter);
app.use('/api/tracking', authenticate, trackingRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: { code: 500, message: 'Internal server error' } });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
