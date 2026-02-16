# Good Neighbors — Backend

## Overview
Node.js + Express + Prisma backend API for a neighbor-to-neighbor sharing/rental platform. PostgreSQL database with 11 models.

## Tech Stack
- Node.js, Express, Prisma ORM, PostgreSQL
- JWT auth via HTTP-only cookies (+ header fallback)
- `cookie-parser`, `bcrypt`, `express-rate-limit`, `express-validator`, `multer`

## Running
```bash
npm run dev     # nodemon, port 3000
npm run db:seed # seed demo data (12 users, 16 items, 3 requests)
```

## Conventions

### Auth Flow
- Login/register set JWT in an **HTTP-only cookie** (`Set-Cookie: token=...`)
- JSON response contains `user` object but **no token field**
- `authMiddleware.js` reads token from cookie first, falls back to `Authorization: Bearer` header
- Cookie config in `src/config/cookie.js` (httpOnly, secure in prod, sameSite lax/strict, maxAge from JWT expiry)
- Logout clears the cookie via `res.clearCookie()`

### API Structure
- Routes in `src/routes/` map 1:1 to controllers in `src/controllers/`
- All routes prefixed with `/api/` (e.g. `/api/auth/login`, `/api/items`)
- Middleware: `authenticate` (required auth), `optionalAuth` (attach user if cookie/header present)
- Error handling: `asyncHandler` wrapper + global `errorHandler` middleware
- Rate limiting on `/api/auth/login` and `/api/auth/register` (10 req / 15 min)

### Categories
- 3-tier hierarchical system: `listingType` → `categoryTier1` → `categoryTier2` → `categoryTier3`
- Legacy flat `category` field maintained for backward compatibility
- Spec definitions per category in `src/utils/specUtils.js`

### Matching
- Bidirectional: items auto-match to open requests, requests auto-match to available items
- Match scoring (0-100) based on category, specs, distance, pricing compatibility
- `src/utils/matching.js` handles all scoring logic

### Transactions
- 9-state lifecycle: `requested` → `accepted` → `pickup_confirmed` → `active` → `return_initiated` → `return_confirmed` → `completed` (+ `cancelled`, `declined`)
- Fee calculation: cheapest-tier auto-selection, 50/50 platform fee, state tax
- Date conflict checking via `src/utils/dateConflict.js`

### CORS
- Configured in `src/server.js`: origin from `CORS_ORIGIN` env var (default `http://localhost:5173`)
- `credentials: true` enabled (required for cookie auth)

## Key Directories
```
src/
  config/          # database.js (Prisma), jwt.js, cookie.js
  controllers/     # authController, itemController, requestController, etc.
  routes/          # Express route definitions
  middleware/      # authMiddleware, validation, errorHandler
  utils/           # matching, feeCalculation, dateConflict, specUtils, distance, taxRates
  services/        # notificationService (19 types), schedulerService (hourly tasks)
prisma/
  schema.prisma    # 11 models
  seed.js          # Demo data
```

## Reference Docs
- **Tracking doc:** `C:/Users/robbi/Rob/AI/Good Neighbors/claude_GN_bugs_improvs_adds.md`
- **Working log:** `C:/Users/robbi/Rob/AI/Good Neighbors/good_neighbors_working_log.md`
