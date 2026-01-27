# Good Neighbors Backend API

Peer-to-Peer Neighborhood Sharing Platform - Backend API

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 14+
- **ORM:** Prisma
- **Auth:** JWT (jsonwebtoken + bcrypt)

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- Git

### 2. Clone and Install

```bash
git clone https://github.com/800rob/good_neighbors.git
cd good_neighbors
npm install
```

### 3. Database Setup

**Option A: Using local PostgreSQL**

1. Start PostgreSQL service
2. Create database:
```bash
psql -U postgres
CREATE DATABASE good_neighbors;
\q
```

**Option B: Using Docker**

```bash
docker run --name good-neighbors-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=good_neighbors -p 5432:5432 -d postgres:14
```

### 4. Environment Configuration

Copy the example env file and update if needed:

```bash
cp .env.example .env
```

Default `.env` configuration:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/good_neighbors
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### 5. Run Migrations

```bash
npm run db:migrate
```

Or push schema directly (for development):

```bash
npm run db:push
```

### 6. Seed Database (Optional)

```bash
npm run db:seed
```

This creates:
- 6 test users (password: `password123`)
- 16 sample items across categories
- 3 sample requests with auto-generated matches
- 1 completed transaction with ratings and messages

### 7. Start the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs at: `http://localhost:3000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| POST | `/api/auth/logout` | Logout (protected) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update current user |
| GET | `/api/users/:id` | Get public user profile |
| GET | `/api/users/:id/ratings` | Get user's ratings |

### Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/items` | Create item listing |
| GET | `/api/items` | Browse items (with filters) |
| GET | `/api/items/my-listings` | Get your listings |
| GET | `/api/items/:id` | Get item details |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Soft delete item |

**Query Parameters for GET /api/items:**
- `category` - Filter by category
- `subcategory` - Filter by subcategory
- `condition` - Filter by condition
- `pricingType` - Filter by pricing type
- `minPrice` / `maxPrice` - Price range
- `latitude` / `longitude` - Your location
- `radiusMiles` - Max distance (default: 25)
- `limit` / `offset` - Pagination

### Requests (Core Feature)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Post a need |
| GET | `/api/requests/my-requests` | Get your requests |
| GET | `/api/requests/:id` | Get request details |
| PUT | `/api/requests/:id/cancel` | Cancel request |
| GET | `/api/requests/:id/matches` | Get matches for request |

### Matches

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matches/incoming` | Get matches for your items |
| PUT | `/api/matches/:id/respond` | Accept/decline match |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions/my-transactions` | Get your transactions |
| GET | `/api/transactions/:id` | Get transaction details |
| PUT | `/api/transactions/:id/status` | Update status |
| PUT | `/api/transactions/:id/dispute` | Flag dispute |

**Transaction Status Flow:**
```
requested → accepted → pickup_confirmed → active → return_initiated → return_confirmed → completed
                                    ↘                           ↘
                                   disputed                   disputed
```

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions/:id/messages` | Send message |
| GET | `/api/transactions/:id/messages` | Get conversation |
| GET | `/api/messages/unread-count` | Get unread count |

### Ratings

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions/:id/rating` | Submit rating |
| GET | `/api/transactions/:id/ratings` | Get transaction ratings |

## Example API Calls

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User",
    "address": "123 Main St, Fort Collins, CO",
    "latitude": 40.5853,
    "longitude": -105.0844,
    "neighborhood": "Old Town"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Create Item
```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "category": "tools",
    "subcategory": "power_tools",
    "title": "Cordless Drill",
    "description": "Great condition drill",
    "condition": "excellent",
    "replacementValue": 150,
    "pricingType": "daily",
    "priceAmount": 15,
    "protectionPreference": "let_me_decide",
    "depositPercentage": 50
  }'
```

### Post a Request
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "category": "lawn_garden",
    "title": "Need a pressure washer this weekend",
    "description": "Want to clean my deck",
    "neededFrom": "2024-01-20T09:00:00Z",
    "neededUntil": "2024-01-21T18:00:00Z",
    "maxBudget": 50,
    "maxDistanceMiles": 10
  }'
```

### Respond to Match (as Lender)
```bash
curl -X PUT http://localhost:3000/api/matches/MATCH_ID/respond \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "response": "accepted"
  }'
```

## Categories

- `tools` - Power tools, hand tools
- `outdoor_recreation` - Camping, bikes, sports
- `party_events` - Tables, chairs, speakers, decorations
- `lawn_garden` - Mowers, pressure washers, trimmers
- `vehicles_transport` - Trailers, roof racks
- `workspace` - Garage space, workshop
- `specialized_equipment` - Moving equipment, specialty tools
- `services` - Handyman, cleaning, etc.
- `other` - Anything else

## Protection Types

- `waiver` - Both parties agree, no fees
- `insurance` - Borrower pays 5% of replacement value
- `deposit` - Funds held in escrow (configurable %)

## Database Commands

```bash
# Run migrations
npm run db:migrate

# Push schema (development)
npm run db:push

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio

# Regenerate Prisma client
npm run db:generate
```

## Project Structure

```
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.js          # Seed data script
├── src/
│   ├── config/
│   │   ├── database.js  # Prisma client
│   │   └── jwt.js       # JWT config
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth, validation, errors
│   ├── routes/          # API routes
│   ├── utils/
│   │   ├── distance.js  # Haversine formula
│   │   └── matching.js  # Match algorithm
│   └── server.js        # Express app
├── .env                 # Environment variables
└── package.json
```

## Test Accounts (after seeding)

| Email | Neighborhood | Password |
|-------|--------------|----------|
| alice@example.com | Old Town | password123 |
| bob@example.com | Campus West | password123 |
| carol@example.com | Midtown | password123 |
| david@example.com | Harmony | password123 |
| emma@example.com | Drake | password123 |
| frank@example.com | Timberline | password123 |

## License

ISC
