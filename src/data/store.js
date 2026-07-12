const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
  constructor() {
    this.data = this._loadSeed();
    this.counters = this._initCounters();
    this._ensureDefaultApiKey();
  }

  _loadSeed() {
    const seedPath = path.join(__dirname, '..', '..', 'seed.json');
    const raw = fs.readFileSync(seedPath, 'utf-8');
    const seed = JSON.parse(raw);
    return {
      apiKeys: [],
      provinces: seed.provinces || [],
      districts: seed.districts || [],
      stations: seed.stations || [],
      vehicles: (seed.vehicles || []).map(v => ({ ...v, status: 'active', created_at: '2026-01-01T00:00:00Z' })),
      drivers: [],
      trips: [],
      pings: seed.pings || [],
    };
  }

  _initCounters() {
    const counters = {};
    for (const [key, items] of Object.entries(this.data)) {
      counters[key] = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    }
    return counters;
  }

  _ensureDefaultApiKey() {
    if (this.data.apiKeys.length === 0) {
      this.data.apiKeys.push({
        id: this._nextId('apiKeys'),
        key: 'taxico-default-key-2026',
        name: 'Default Admin Key',
        created_at: new Date().toISOString(),
      });
    }
  }

  _nextId(entity) {
    return this.counters[entity]++;
  }

  _timestamps() {
    return { created_at: new Date().toISOString() };
  }

  validateApiKey(key) {
    return this.data.apiKeys.find(k => k.key === key);
  }

  list(entity, filters = {}) {
    let items = this.data[entity];
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        items = items.filter(i => String(i[key]) === String(value));
      }
    }
    return items;
  }

  getById(entity, id) {
    return this.data[entity].find(i => i.id === Number(id)) || null;
  }

  create(entity, fields) {
    const item = { id: this._nextId(entity), ...fields, ...this._timestamps() };
    this.data[entity].push(item);
    return item;
  }

  update(entity, id, fields) {
    const idx = this.data[entity].findIndex(i => i.id === Number(id));
    if (idx === -1) return null;
    Object.assign(this.data[entity][idx], fields);
    return this.data[entity][idx];
  }

  delete(entity, id) {
    const idx = this.data[entity].findIndex(i => i.id === Number(id));
    if (idx === -1) return false;
    this.data[entity].splice(idx, 1);
    return true;
  }

  generateApiKey(name) {
    const key = crypto.randomUUID();
    return this.create('apiKeys', { key, name });
  }

  getVehicleWithLocation(id) {
    const vehicle = this.getById('vehicles', id);
    if (!vehicle) return null;
    const pings = this.list('pings', { vehicle_id: id });
    const latest = pings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
    const station = this.getById('stations', vehicle.station_id);
    return {
      ...vehicle,
      station_name: station ? station.name : null,
      current_location: latest ? { latitude: latest.latitude, longitude: latest.longitude, timestamp: latest.timestamp } : null,
    };
  }

  getDashboard() {
    const vehicles = this.data.vehicles.filter(v => v.status === 'active');
    const activeTrips = this.data.trips.filter(t => t.status === 'active');
    const tripMap = {};
    for (const t of activeTrips) {
      tripMap[t.vehicle_id] = t;
    }

    return vehicles.map(v => {
      const station = this.getById('stations', v.station_id);
      const pings = this.list('pings', { vehicle_id: v.id });
      const latest = pings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null;
      const trip = tripMap[v.id] || null;
      const driver = trip ? this.getById('drivers', trip.driver_id) : null;
      return {
        vehicle_id: v.id,
        registration_number: v.registration_number,
        device_id: v.device_id,
        station_name: station ? station.name : null,
        latitude: latest ? latest.latitude : null,
        longitude: latest ? latest.longitude : null,
        timestamp: latest ? latest.timestamp : null,
        trip_status: trip ? trip.status : null,
        driver_name: driver ? driver.name : null,
      };
    });
  }
}

module.exports = new Store();
