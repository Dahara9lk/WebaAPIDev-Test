const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
  constructor() {
    this.data = this._loadSeed();
    this.counters = this._initCounters();
    this._ensureDefaultApiKey();
    
    console.log('🔍 Constructor - Drivers count:', this.data.drivers?.length || 0);
    console.log('🔍 Constructor - Trips count:', this.data.trips?.length || 0);
  }

  _loadSeed() {
    const seedPath = path.join(__dirname, '..', '..', 'seed.json');
    try {
      const raw = fs.readFileSync(seedPath, 'utf-8');
      const seed = JSON.parse(raw);
      
      console.log('📦 Loading seed data:');
      console.log(`  - Provinces: ${seed.provinces?.length || 0}`);
      console.log(`  - Districts: ${seed.districts?.length || 0}`);
      console.log(`  - Stations: ${seed.stations?.length || 0}`);
      console.log(`  - Vehicles: ${seed.vehicles?.length || 0}`);
      console.log(`  - Drivers RAW: ${seed.drivers?.length || 0}`);
      console.log(`  - Pings: ${seed.pings?.length || 0}`);
      console.log(`  - Trips RAW: ${seed.trips?.length || 0}`);
      console.log(`  - Users: ${seed.users?.length || 0}`);
      
      const drivers = (seed.drivers || []).map(d => ({
        ...d,
        status: d.status || 'available',
        vehicle_id: d.vehicle_id || null,
        created_at: d.created_at || new Date().toISOString()
      }));
      
      return {
        apiKeys: seed.api_keys || [],
        provinces: seed.provinces || [],
        districts: seed.districts || [],
        stations: seed.stations || [],
        vehicles: (seed.vehicles || []).map(v => ({
          ...v,
          status: v.status || 'active',
          created_at: v.created_at || '2026-01-01T00:00:00Z'
        })),
        drivers: drivers,
        trips: seed.trips || [],
        pings: seed.pings || [],
        users: seed.users || [],
      };
    } catch (error) {
      console.error('❌ Error loading seed data:', error);
      return this._getDefaultData();
    }
  }

  _getDefaultData() {
    return {
      apiKeys: [],
      provinces: [],
      districts: [],
      stations: [],
      vehicles: [],
      drivers: [],
      trips: [],
      pings: [],
      users: [],
    };
  }

  _initCounters() {
    const counters = {};
    for (const [key, items] of Object.entries(this.data)) {
      // If items exist and have ids, use max id + 1, otherwise start at 1
      if (items && items.length > 0) {
        const maxId = Math.max(...items.map(i => i.id));
        counters[key] = maxId + 1;
      } else {
        counters[key] = 1;
      }
    }
    console.log('🔍 Counters initialized:', counters);
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
    // Ensure counter exists
    if (!this.counters[entity]) {
      this.counters[entity] = 1;
    }
    const id = this.counters[entity];
    this.counters[entity]++;
    return id;
  }

  _timestamps() {
    return { created_at: new Date().toISOString() };
  }

  validateApiKey(key) {
    return this.data.apiKeys.find(k => k.key === key);
  }

  findUserByUsername(username) {
    return this.data.users.find(u => u.username === username) || null;
  }

  list(entity, filters = {}) {
    const items = this.data[entity] || [];
    
    if (Object.keys(filters).length === 0) {
      return items;
    }
    
    return items.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          if (String(item[key]) !== String(value)) {
            return false;
          }
        }
      }
      return true;
    });
  }

  getById(entity, id) {
    const items = this.data[entity] || [];
    return items.find(i => i.id === Number(id)) || null;
  }

  create(entity, fields) {
    console.log(`📝 Creating ${entity}...`);
    
    // Initialize array if it doesn't exist
    if (!this.data[entity]) {
      this.data[entity] = [];
    }
    
    const id = this._nextId(entity);
    const item = { 
      id: id, 
      ...fields, 
      ...this._timestamps() 
    };
    
    this.data[entity].push(item);
    console.log(`✅ Created ${entity} with ID: ${id}`);
    return item;
  }

  update(entity, id, fields) {
    const items = this.data[entity] || [];
    const idx = items.findIndex(i => i.id === Number(id));
    if (idx === -1) {
      console.log(`❌ ${entity} with ID ${id} not found for update`);
      return null;
    }
    Object.assign(items[idx], fields);
    console.log(`✅ Updated ${entity} with ID: ${id}`);
    return items[idx];
  }

  delete(entity, id) {
    const items = this.data[entity] || [];
    const idx = items.findIndex(i => i.id === Number(id));
    if (idx === -1) return false;
    items.splice(idx, 1);
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
      current_location: latest ? { 
        latitude: latest.latitude, 
        longitude: latest.longitude, 
        timestamp: latest.timestamp 
      } : null,
    };
  }

  getDriverWithDetails(id) {
    const driver = this.getById('drivers', id);
    if (!driver) return null;
    const station = this.getById('stations', driver.station_id);
    const vehicle = driver.vehicle_id ? this.getById('vehicles', driver.vehicle_id) : null;
    return {
      ...driver,
      station_name: station ? station.name : null,
      vehicle: vehicle || null,
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
        driver_id: driver ? driver.id : null,
      };
    });
  }

  getTripWithDetails(id) {
    const trip = this.getById('trips', id);
    if (!trip) return null;
    const vehicle = this.getById('vehicles', trip.vehicle_id);
    const driver = this.getById('drivers', trip.driver_id);
    return {
      ...trip,
      registration_number: vehicle ? vehicle.registration_number : null,
      driver_name: driver ? driver.name : null,
    };
  }
}

module.exports = new Store();