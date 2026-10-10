# TaxiCo Vehicle Tracking REST API — Project Plan

## Overview

This document describes the design of a RESTful API for a taxi company operating across Sri Lanka. The system allows the company to manage its fleet of vehicles, assign drivers, track GPS location pings from onboard devices, and manage taxi trips from origin to destination.

The API builds on the geographic hierarchy already present in the project's seed data — **Provinces → Districts → Stations** — and extends it with **Vehicles**, **Drivers**, **Trips**, and **GPS Pings**.

---

## Assumptions

The following assumptions were made during the design phase. Any deviation from real-world requirements should trigger a revision of this document.

### Business assumptions

1. **Sri Lanka–only operation.** The geographic hierarchy (provinces, districts, stations) is fixed to Sri Lanka's 9 provinces and 25 districts.
2. **Station–centric fleet management.** Every vehicle and driver is assigned to exactly one station (branch). A station belongs to one district.
3. **One device per vehicle.** Each vehicle carries exactly one GPS tracking device identified by a `device_id`. The device sends periodic location pings.
4. **Driver–trip coupling.** A driver can be on at most one active trip at a time. Starting a new trip sets the driver's status to `on_trip` and completing or cancelling the trip returns the driver to `available`.
5. **No customer entity.** The API tracks trips (origin → destination) but does not manage customer profiles, bookings, or payments.
6. **No fare tracking.** Trip cost, rate calculation, and billing are out of scope.
7. **No real-time streaming.** All GPS data is exchanged via HTTP request–response. WebSocket, SSE, or push notifications are not part of this design.

### Technical assumptions

8. **In-memory data store.** All data is loaded from `seed.json` at startup and held in JavaScript arrays. Changes are ephemeral — the server resets to seed state on restart.
9. **Express 5.x** as the HTTP framework (already present in `package.json`).
10. **JWT authentication.** Every request under `/api/*` (except `/api/auth/login`) requires a valid JWT access token sent via the `Authorization: Bearer <token>` header. Login credentials (username + password) are exchanged for a JWT at `/api/auth/login`.
11. **Role-based authorization.** Three roles control access: `admin` (full access), `dispatcher` (trip management + view), `driver` (send pings, view own data).
12. **JSON only.** Both request bodies and response payloads use `application/json`. No XML, form-encoded, or multipart support.
13. **Integer IDs.** All resources use auto-incrementing integer primary keys.

---

## Data Model

### Entity-Relationship Diagram (text)

```
Province 1──N District 1──N Station 1──N Vehicle 1──N Ping
                                            │
                                     Driver ─┼── N Trip
```

- A **Province** has many **Districts**.
- A **District** has many **Stations**.
- A **Station** has many **Vehicles** and many **Drivers**.
- A **Vehicle** has many **Pings** (GPS breadcrumbs) and many **Trips**.
- A **Driver** has many **Trips**.
- A **Trip** belongs to exactly one **Vehicle** and exactly one **Driver**.

### Entity definitions

#### Province

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `name` | string | `"Western Province"` | Read-only seed data |

**Source:** `seed.json` → `provinces[]`.  
**Immutability:** Static reference data; no create/update/delete endpoints.

---

#### District

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `name` | string | `"Colombo"` | |
| `province_id` | number | `1` | Foreign key → Province |

**Source:** `seed.json` → `districts[]`.  
**Immutability:** Static reference data; no create/update/delete endpoints.

---

#### Station

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `name` | string | `"Colombo Central"` | |
| `district_id` | number | `1` | Foreign key → District |

**Source:** `seed.json` → `stations[]`.  
**Immutability:** Static reference data; no create/update/delete endpoints.

---

#### Vehicle

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `registration_number` | string | `"WP-COL-0001"` | Licence plate. Format: `{province_code}-{station_code}-{seq}` |
| `device_id` | string | `"DEV0001"` | GPS device serial number. Should be unique. |
| `station_id` | number | `1` | Foreign key → Station (home station) |
| `status` | enum | `"active"` | One of: `active`, `maintenance`, `retired` |
| `created_at` | string (ISO 8601) | `"2026-01-01T00:00:00Z"` | Server-generated timestamp |

**Source:** `seed.json` → `vehicles[]` (with `status` and `created_at` added at load time).

---

#### Driver

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `name` | string | `"Kamal Perera"` | Full name |
| `license_number` | string | `"B-1234567"` | Driving licence number |
| `phone` | string | `"0771000001"` | Contact number (nullable) |
| `station_id` | number | `1` | Foreign key → Station (home station) |
| `status` | enum | `"available"` | One of: `available`, `on_trip`, `off_duty` |
| `created_at` | string (ISO 8601) | auto-generated | Server-generated timestamp |

**Source:** Seed data added to `seed.json` → `drivers[]`.

---

#### Trip

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `vehicle_id` | number | `1` | Foreign key → Vehicle |
| `driver_id` | number | `1` | Foreign key → Driver |
| `origin` | string | `"Colombo Fort"` | Text description of pickup |
| `destination` | string | `"Kandy Clock Tower"` | Text description of dropoff |
| `origin_lat` | number | `6.9344` | Pickup latitude (nullable) |
| `origin_lng` | number | `79.8428` | Pickup longitude (nullable) |
| `dest_lat` | number | `7.2906` | Dropoff latitude (nullable, often set on completion) |
| `dest_lng` | number | `80.6337` | Dropoff longitude (nullable, often set on completion) |
| `start_time` | string (ISO 8601) | auto-generated | Server-generated when trip starts |
| `end_time` | string (ISO 8601) | `null` | Set when trip completes or is cancelled |
| `status` | enum | `"active"` | One of: `active`, `completed`, `cancelled` |

**Source:** Created at runtime. No seed data.

**Lifecycle rules:**
- `POST /api/trips` → creates with `status = "active"` and sets driver to `on_trip`. Rejects if driver already on a trip.
- `PATCH /api/trips/:id/complete` → sets `status = "completed"`, records `end_time`, sets driver to `available`.
- `PATCH /api/trips/:id/cancel` → sets `status = "cancelled"`, records `end_time`, sets driver to `available`.

---

#### Ping

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `vehicle_id` | number | `1` | Foreign key → Vehicle |
| `latitude` | number | `6.9271` | WGS-84 decimal degrees |
| `longitude` | number | `79.8612` | WGS-84 decimal degrees |
| `timestamp` | string (ISO 8601) | `"2026-06-01T08:00:00Z"` | When the ping was recorded (client or server) |

**Source:** `seed.json` → `pings[]` and POST at runtime.

**Immutability:** Pings are append-only. Once created they are never updated or deleted.

---

### Additional internal entity: ApiKey

| Field | Type | Notes |
|---|---|---|
| `id` | number | Primary key |
| `key` | string | UUID or arbitrary secret string |
| `name` | string | Human-readable label (e.g., "Mobile App") |
| `created_at` | string (ISO 8601) | Timestamp |

**Default key:** `taxico-default-key-2026` is created automatically if no keys exist.

---

### User (authentication)

| Field | Type | Example | Notes |
|---|---|---|---|
| `id` | number | `1` | Primary key, auto-increment |
| `username` | string | `"admin"` | Unique login name |
| `email` | string | `"admin@taxico.lk"` | Unique email address |
| `password` | string | `"$2b$10$..."` | bcrypt hash — never stored in plaintext |
| `role` | enum | `"admin"` | One of: `admin`, `dispatcher`, `driver` |
| `created_at` | string (ISO 8601) | `"2026-07-19T00:00:00Z"` | Server-generated timestamp |

**Source:** `seed.json` → `users[]`.

**Seed users:**

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `dispatcher01` | `dispatcher123` | dispatcher |
| `dispatcher02` | `dispatcher123` | dispatcher |
| `driver01` | `driver123` | driver |
| `driver02` | `driver123` | driver |

---

## API Routes

### Conventions

- **Base path:** `/api`
- **Auth:** Every endpoint under `/api` requires a valid JWT access token via `Authorization: Bearer <token>` header (exception: `/api/auth/login` is public). Role-based authorization is enforced per-route.
- **Response envelope:**

  **Collection:**
  ```json
  {
    "data": [ ... ],
    "count": 42
  }
  ```

  **Single resource:**
  ```json
  {
    "data": { ... }
  }
  ```

  **Error:**
  ```json
  {
    "error": {
      "code": 404,
      "message": "Vehicle not found"
    }
  }
  ```

- **HTTP status codes used:**
  - `200` — Success (GET, PUT, PATCH)
  - `201` — Created (POST)
  - `204` — Deleted (DELETE, no body)
  - `400` — Validation error (missing/invalid fields)
  - `401` — Missing or invalid JWT token, or invalid credentials
  - `403` — Forbidden: insufficient role permissions
  - `404` — Resource not found
  - `409` — Conflict (e.g., driver already on a trip)
  - `500` — Internal server error

### Full route table

#### Authentication

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | No | — | Exchange username + password for a JWT access token |

---

#### Discovery & health

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/` | No | — | HTML welcome page |
| `GET` | `/api` | No | — | JSON endpoint listing all available resource paths |

---

#### Key management

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/keys` | JWT | admin | List all API keys |
| `POST` | `/api/keys` | JWT | admin | Create a new API key (body: `{ "name": "..." }`) |
| `DELETE` | `/api/keys/:id` | JWT | admin | Revoke (delete) an API key |

---

#### Provinces (read-only reference data)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/provinces` | JWT | all authenticated | List all provinces |
| `GET` | `/api/provinces/:id` | JWT | all authenticated | Get single province by ID (404 if not found) |
| `GET` | `/api/provinces/:id/districts` | JWT | all authenticated | List districts belonging to a province |

---

#### Districts (read-only reference data)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/districts` | JWT | all authenticated | List districts. Query: `?province_id=` to filter |
| `GET` | `/api/districts/:id` | JWT | all authenticated | Get single district (includes `province_name`) |
| `GET` | `/api/districts/:id/stations` | JWT | all authenticated | List stations in a district |

---

#### Stations (read-only reference data)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/stations` | JWT | all authenticated | List stations. Query: `?district_id=` to filter |
| `GET` | `/api/stations/:id` | JWT | all authenticated | Get single station (includes `district_name`) |
| `GET` | `/api/stations/:id/vehicles` | JWT | all authenticated | List vehicles assigned to the station |
| `GET` | `/api/stations/:id/drivers` | JWT | all authenticated | List drivers assigned to the station |

---

#### Vehicles (CRUD + tracking sub-resources)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/vehicles` | JWT | all authenticated | List vehicles. Query: `?station_id=&status=` |
| `GET` | `/api/vehicles/:id` | JWT | all authenticated | Get vehicle details — includes `station_name` and `current_location` (latest ping) |
| `POST` | `/api/vehicles` | JWT | admin | Register new vehicle. Body: `{ registration_number, device_id, station_id, status? }` |
| `PUT` | `/api/vehicles/:id` | JWT | admin | Update vehicle fields (partial update of allowed fields) |
| `DELETE` | `/api/vehicles/:id` | JWT | admin | Remove vehicle from fleet |
| `GET` | `/api/vehicles/:id/pings` | JWT | all authenticated | Get ping history. Query: `?from=&to=&limit=` |
| `GET` | `/api/vehicles/:id/current-location` | JWT | all authenticated | Get the single most recent ping for this vehicle |
| `GET` | `/api/vehicles/:id/trips` | JWT | all authenticated | Get trip history for this vehicle (includes driver name) |

---

#### Drivers (CRUD + trip history)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/drivers` | JWT | all authenticated | List drivers. Query: `?station_id=&status=` |
| `GET` | `/api/drivers/:id` | JWT | all authenticated | Get single driver (includes `station_name`) |
| `POST` | `/api/drivers` | JWT | admin | Add new driver. Body: `{ name, license_number, phone?, station_id, status? }` |
| `PUT` | `/api/drivers/:id` | JWT | admin | Update driver fields |
| `DELETE` | `/api/drivers/:id` | JWT | admin | Remove driver |
| `GET` | `/api/drivers/:id/trips` | JWT | all authenticated | Get trip history for this driver (includes vehicle registration) |

---

#### Trips (lifecycle management)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/trips` | JWT | admin, dispatcher | List trips. Query: `?vehicle_id=&driver_id=&status=&from=&to=` |
| `GET` | `/api/trips/:id` | JWT | all authenticated | Get trip details with vehicle reg and driver name |
| `POST` | `/api/trips` | JWT | admin, dispatcher | Start a new trip. Body: `{ vehicle_id, driver_id, origin, destination, origin_lat?, origin_lng?, dest_lat?, dest_lng? }` |
| `PATCH` | `/api/trips/:id/complete` | JWT | admin, dispatcher | Mark trip as completed. Body: optional `{ dest_lat, dest_lng, destination, end_time }` |
| `PATCH` | `/api/trips/:id/cancel` | JWT | admin, dispatcher | Mark trip as cancelled |

**Side effects of POST /api/trips:**
- Driver status → `on_trip`
- Returns 409 if driver already on a trip or vehicle not active

**Side effects of PATCH .../complete and .../cancel:**
- Driver status → `available`
- `end_time` is set to current server time (overridable in body for `complete`)

---

#### Pings / GPS (append + query)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/pings` | JWT | admin, dispatcher | Query pings. Query: `?vehicle_id=&from=&to=&limit=` |
| `POST` | `/api/pings` | JWT | admin, driver | Record a GPS ping. Body: `{ vehicle_id, latitude, longitude, timestamp? }` |

---

#### Dashboard (live map overview)

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/api/tracking/dashboard` | JWT | all authenticated | Returns the latest ping for every active vehicle, plus current trip status and driver name |

---

## JSON Request / Response Examples

### GET /api/provinces

**Response:**
```json
{
  "data": [
    { "id": 1, "name": "Western Province" },
    { "id": 2, "name": "Central Province" }
  ]
}
```

---

### GET /api/vehicles/1

**Response:**
```json
{
  "data": {
    "id": 1,
    "registration_number": "WP-COL-0001",
    "device_id": "DEV0001",
    "station_id": 1,
    "station_name": "Colombo Central",
    "status": "active",
    "created_at": "2026-01-01T00:00:00Z",
    "current_location": {
      "latitude": 6.9411,
      "longitude": 79.8772,
      "timestamp": "2026-06-07T16:30:00Z"
    }
  }
}
```

---

### POST /api/vehicles

**Request:**
```json
{
  "registration_number": "WP-COL-0100",
  "device_id": "DEV0201",
  "station_id": 1,
  "status": "active"
}
```

**Response (201):**
```json
{
  "data": {
    "id": 201,
    "registration_number": "WP-COL-0100",
    "device_id": "DEV0201",
    "station_id": 1,
    "station_name": "Colombo Central",
    "status": "active",
    "created_at": "2026-07-12T10:30:00Z"
  }
}
```

---

### POST /api/trips — start a trip

**Request:**
```json
{
  "vehicle_id": 1,
  "driver_id": 5,
  "origin": "Colombo Fort Railway Station",
  "destination": "Kandy Clock Tower",
  "origin_lat": 6.9344,
  "origin_lng": 79.8428
}
```

**Response (201):**
```json
{
  "data": {
    "id": 1,
    "vehicle_id": 1,
    "driver_id": 5,
    "registration_number": "WP-COL-0001",
    "driver_name": "Ranjith Kumara",
    "origin": "Colombo Fort Railway Station",
    "destination": "Kandy Clock Tower",
    "origin_lat": 6.9344,
    "origin_lng": 79.8428,
    "dest_lat": null,
    "dest_lng": null,
    "start_time": "2026-07-12T10:30:00Z",
    "end_time": null,
    "status": "active"
  }
}
```

---

### PATCH /api/trips/1/complete — complete a trip

**Request:**
```json
{
  "dest_lat": 7.2906,
  "dest_lng": 80.6337,
  "destination": "Kandy Clock Tower"
}
```

**Response (200):**
```json
{
  "data": {
    "id": 1,
    "vehicle_id": 1,
    "driver_id": 5,
    "registration_number": "WP-COL-0001",
    "driver_name": "Ranjith Kumara",
    "origin": "Colombo Fort Railway Station",
    "destination": "Kandy Clock Tower",
    "origin_lat": 6.9344,
    "origin_lng": 79.8428,
    "dest_lat": 7.2906,
    "dest_lng": 80.6337,
    "start_time": "2026-07-12T10:30:00Z",
    "end_time": "2026-07-12T14:30:00Z",
    "status": "completed"
  }
}
```

---

### POST /api/pings — record a GPS ping

**Request:**
```json
{
  "vehicle_id": 1,
  "latitude": 6.9271,
  "longitude": 79.8612,
  "timestamp": "2026-07-12T10:35:00Z"
}
```

**Response (201):**
```json
{
  "data": {
    "id": 85,
    "vehicle_id": 1,
    "latitude": 6.9271,
    "longitude": 79.8612,
    "timestamp": "2026-07-12T10:35:00Z"
  }
}
```

---

### GET /api/tracking/dashboard — live overview

**Response:**
```json
{
  "data": [
    {
      "vehicle_id": 1,
      "registration_number": "WP-COL-0001",
      "device_id": "DEV0001",
      "station_name": "Colombo Central",
      "latitude": 6.9411,
      "longitude": 79.8772,
      "timestamp": "2026-06-07T16:30:00Z",
      "trip_status": "active",
      "driver_name": "Kamal Perera"
    },
    {
      "vehicle_id": 2,
      "registration_number": "WP-COL-0002",
      "device_id": "DEV0002",
      "station_name": "Colombo Central",
      "latitude": 6.9311,
      "longitude": 79.8672,
      "timestamp": "2026-06-07T16:10:00Z",
      "trip_status": null,
      "driver_name": null
    }
  ],
  "count": 200
}
```

---

### GET /api/vehicles/1/pings?from=2026-06-01&to=2026-06-03&limit=5

**Response:**
```json
{
  "data": [
    { "id": 1, "vehicle_id": 1, "latitude": 6.9271, "longitude": 79.8612, "timestamp": "2026-06-01T08:00:00Z" },
    { "id": 2, "vehicle_id": 1, "latitude": 6.9278, "longitude": 79.8620, "timestamp": "2026-06-01T12:00:00Z" },
    { "id": 3, "vehicle_id": 1, "latitude": 6.9285, "longitude": 79.8628, "timestamp": "2026-06-01T16:00:00Z" },
    { "id": 4, "vehicle_id": 1, "latitude": 6.9292, "longitude": 79.8636, "timestamp": "2026-06-02T08:05:00Z" },
    { "id": 5, "vehicle_id": 1, "latitude": 6.9299, "longitude": 79.8644, "timestamp": "2026-06-02T12:05:00Z" }
  ],
  "count": 5
}
```

---

### Error: 401 Unauthorized

**Request (missing header):**
```
GET /api/vehicles
```

**Response:**
```json
{
  "error": {
    "code": 401,
    "message": "Missing Authorization header"
  }
}
```

---

### Error: 409 Conflict

**Request (driver already on trip):**
```
POST /api/trips  { "vehicle_id": 2, "driver_id": 5, ... }
```

**Response:**
```json
{
  "error": {
    "code": 409,
    "message": "Driver is already on a trip"
  }
}
```

---

## Project File Structure

```
F:\webAPI-proj\WebaAPIDev-Test\
├── project.md              ← This file
├── server.js               ← Express app entry point
├── package.json
├── .env                    ← Environment variables (MongoDB URI, JWT secret)
├── README.md
├── seed.json               ← Seed data (provinces, districts, stations, vehicles, pings, drivers, users)
├── importSeed.js           ← MongoDB Atlas seed importer
├── src/
│   ├── data/
│   │   └── store.js        ← In-memory data store (CRUD helpers, seed loader)
│   ├── middleware/
│   │   ├── authenticate.js ← JWT token verification
│   │   └── authorize.js    ← Role-based access control
│   └── routes/
│       ├── auth.js         ← POST /api/auth/login (JWT token generation)
│       ├── keys.js         ← API key management
│       ├── provinces.js    ← Province endpoints
│       ├── districts.js    ← District endpoints
│       ├── stations.js     ← Station endpoints
│       ├── vehicles.js     ← Vehicle CRUD + sub-resources
│       ├── drivers.js      ← Driver CRUD + sub-resources
│       ├── trips.js        ← Trip lifecycle
│       ├── pings.js        ← GPS ping CRUD
│       └── tracking.js     ← Dashboard endpoint
```

---

## Implementation Order

1. **`src/data/store.js`** — In-memory data store loading seed.json with `list`, `getById`, `create`, `update`, `delete` generics, plus domain-specific helpers (`getVehicleWithLocation`, `getDashboard`)
2. **`src/middleware/auth.js`** — API key check (original; later replaced by JWT)
3. **Route files** (in order):
   - `provinces.js`, `districts.js`, `stations.js` (read-only)
   - `vehicles.js` (core CRUD + sub-resources)
   - `drivers.js` (CRUD)
   - `trips.js` (lifecycle with driver status side effects)
   - `pings.js` (append + query)
   - `tracking.js` (dashboard aggregation)
   - `keys.js` (admin key management)
4. **`server.js`** — Wire all routes with auth middleware, add JSON body parsing and error handler
5. **`seed.json`** — Add `drivers[]` array
6. **JWT authentication phase:**
   - Install `bcryptjs` and `jsonwebtoken` packages
   - Add `JWT_SECRET` and `JWT_EXPIRES_IN` to `.env`
   - Create `src/middleware/authenticate.js` — JWT token verification
   - Create `src/middleware/authorize.js` — role-checking middleware factory
   - Create `src/routes/auth.js` — `POST /api/auth/login` endpoint
   - Add `users[]` to `seed.json` with pre-hashed passwords
   - Update `src/data/store.js` — load users, add `findUserByUsername()`
   - Update `server.js` — replace `auth` middleware with `authenticate`, add role guards
   - Update `importSeed.js` — add `users` collection
   - Update `project.md` — document JWT auth
7. **Smoke test** every endpoint

---

## Validation Rules Summary

| Resource | Field | Rule |
|---|---|---|
| Vehicle | `registration_number` | Required on create |
| Vehicle | `device_id` | Required on create |
| Vehicle | `station_id` | Required on create, must reference existing station |
| Driver | `name` | Required on create |
| Driver | `license_number` | Required on create |
| Driver | `station_id` | Required on create, must reference existing station |
| Trip | `vehicle_id` | Required, must reference existing active vehicle |
| Trip | `driver_id` | Required, must reference existing driver not already on trip |
| Trip | `origin`, `destination` | Required |
| Ping | `vehicle_id` | Required, must reference existing vehicle |
| Ping | `latitude`, `longitude` | Required, must be numeric |
| Auth | `Authorization: Bearer <token>` | Required on all `/api/*` routes (except `/api/auth/login`); invalid/expired token returns 401 |
| Auth | Role | `admin`, `dispatcher`, `driver` — checked per-route; insufficient role returns 403 |
| User | `username` | Required on create, unique |
| User | `email` | Required on create, unique |
| User | `password` | Required on create, stored as bcrypt hash |
| User | `role` | Required on create, one of: `admin`, `dispatcher`, `driver` |
