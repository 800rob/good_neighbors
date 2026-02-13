# Good Neighbors — Full App Review

**Reviewed by:** Claude (Opus 4.6)
**Date:** February 9, 2026 (last updated: February 13, 2026 — quick wins batch: A-11/A-12/A-13/A-14/A-21/A-25/I-33/UI-11)
**Scope:** Complete codebase — backend controllers, utilities, services, schema, seed data, frontend pages, components, API layer, contexts, types, and config.

---

## Effort Legend

| Label | Claude Tokens | Wall Clock (w/ Claude) | Description |
|-------|--------------|----------------------|-------------|
| **Trivial** | ~1–2K | 2–5 min | Single-line or few-line change, one file |
| **Small** | ~3–5K | 5–15 min | A handful of lines across 1–2 files |
| **Medium** | ~10–20K | 15–45 min | Multi-file change, moderate logic |
| **Large** | ~30–50K | 1–2 hrs | New utility/component, touches many files |
| **XL** | ~50–100K+ | 2–5 hrs | New feature end-to-end (model + API + UI) |

---

## Table of Contents

1. [Bugs](#1-bugs)
   - [Critical](#critical)
   - [High](#high)
   - [Medium](#medium)
   - [Low](#low)
2. [Improvements](#2-improvements)
   - [High Priority](#high-priority)
   - [Medium Priority](#medium-priority)
   - [Low Priority](#low-priority)
3. [Additions](#3-additions)
   - [High Value](#high-value)
   - [Medium Value](#medium-value)
   - [Nice to Have](#nice-to-have)
4. [UI & Aesthetic Enhancements](#4-ui--aesthetic-enhancements)
   - [High Impact](#high-impact)
   - [Medium Impact](#medium-impact)
   - [Low Impact](#low-impact)
5. [Moonshot Additions](#5-moonshot-additions-ambitious-feature-roadmap)
   - [Infrastructure & Platform](#infrastructure--platform) (M-01 → M-06)
   - [User Experience & Engagement](#user-experience--engagement) (M-07 → M-24)

---

# 1. Bugs

## Critical

### B-01: ~~Seed file uses wrong field names — blocks `npm run db:seed`~~ ✅ FIXED
**File:** `prisma/seed.js` (lines 29, 40, 51, 63, 75, 87)
**Impact:** Complete seed failure — development blocker

The primary seed file uses `fullName: 'Alice Johnson'` but the User schema defines separate `firstName` and `lastName` fields. `seedDemo.js` does it correctly.

**Fix:** Replace all 6 `fullName` entries with separate `firstName` / `lastName` fields.
**Status:** Fixed — all 6 users updated to use `firstName`/`lastName`.

---

### B-02: ~~Hardcoded insecure JWT secret~~ ✅ FIXED
**File:** `src/config/jwt.js` (line 2)
**Impact:** Complete auth bypass in production if `JWT_SECRET` env var is unset

```js
secret: process.env.JWT_SECRET || 'your-secret-key'
```

**Fix:** Throw an error if `JWT_SECRET` is not set instead of falling back to a hardcoded value.
**Status:** Fixed — throws `Error('JWT_SECRET environment variable is required')` on startup if unset.

---

### B-03: ~~`requested` status not in BLOCKING_STATUSES — allows double-booking~~ ✅ FIXED
**File:** `src/utils/dateConflict.js` (line 7)
**Impact:** Two borrowers can create overlapping transactions for the same item

The `BLOCKING_STATUSES` array is `['accepted', 'pickup_confirmed', 'active', 'return_initiated']`. Since `requested` is excluded, two users can both create transactions for the same dates — both pass the conflict check — and both can later be accepted.

**Fix:** Add `'requested'` to `BLOCKING_STATUSES`.
**Status:** Fixed — `requested` added to `BLOCKING_STATUSES` array.

---

### B-04: ~~Match notification sends wrong ID to frontend~~ ✅ FIXED
**File:** `src/utils/matching.js` (line 408)
**Impact:** Clicking "View Match" notification navigates to wrong page

When notifying lenders of a new match, the code passes `matchId: matchData.itemId` (the item ID, not the match ID). The frontend uses this to build the navigation URL, so users land on the wrong page.

**Fix:** After `createMany`, fetch the created matches back and use their actual IDs in notifications.
**Status:** Fixed — both forward and reverse matching now fetch created matches and pass correct `matchId` via `Map(itemId → matchId)` / `Map(requestId → matchId)` lookups.

---

### B-05: ~~Distance filtering applied after pagination — users get fewer results than requested~~ ✅ FIXED
**Files:** `itemController.js` (lines 238–263), `requestController.js` (lines 356–375)
**Impact:** User requests 20 items, gets 5 because 15 were filtered out post-fetch

Items/requests are fetched with `take: 20`, then distance filtering removes results. The client gets an inconsistent, short page.

**Fix:** Over-fetch (e.g., 3x limit), apply distance filter, then slice to the requested limit. Or use PostGIS for server-side distance filtering.
**Status:** Fixed (over-fetch approach) — both controllers now fetch 3x limit when distance filtering is active, apply distance filter, then `.slice(0, parsedLimit)` to return the correct page size.

---

### B-06: ~~Race condition in match acceptance — non-atomic state transitions~~ ✅ FIXED
**File:** `matchController.js` (lines 19–44)
**Impact:** Transactions created for expired/cancelled requests; duplicate transactions possible

Between `findUnique` and `update`, another process could change the match/request state. Also, `transactionController.js` has no unique constraint preventing duplicate transactions per match.

**Fix:** Wrap the entire respond-to-match flow in a `prisma.$transaction()`. Add `@@unique([requestId, itemId])` to the Match model and consider `matchId @unique` on Transaction.
**Status:** Fixed — (1) replaced read-then-update with atomic `updateMany` where `lenderResponse: 'pending'` (returns count=0 if already responded), (2) moved request status check before the atomic claim, (3) added `@@unique([requestId, itemId])` on Match model via migration `20260209_add_unique_match_request_item`.

---

### B-07: ~~Late fee calculated using current time instead of actual return time~~ ✅ FIXED
**File:** `transactionController.js` (lines 288–292)
**Impact:** Incorrect billing — borrower charged based on when lender clicks "confirm return", not when item was actually returned

**Fix:** Use `updateData.actualReturnTime` instead of `new Date()` for the late fee calculation.
**Status:** Fixed — uses `updateData.actualReturnTime || new Date()` for late fee computation.

---

### B-08: ~~Rating visibility uses `updatedAt` instead of completion time~~ ✅ FIXED
**File:** `ratingController.js` (lines 146–158)
**Impact:** 7-day visibility window calculated from wrong timestamp

If a transaction is edited after completion, `updatedAt` resets, extending the hidden period.

**Fix:** Use `transaction.actualReturnTime || transaction.updatedAt` as the anchor.
**Status:** Fixed — uses `visibilityAnchor = transaction.actualReturnTime || transaction.updatedAt`.

---

### B-09: ~~Scheduler uses wrong field for request expiration reminders~~ ✅ FIXED
**File:** `schedulerService.js` (lines 292–305)
**Impact:** Reminders sent based on `neededUntil` (when borrower needs item by) instead of `expiresAt` (when request listing expires)

These are semantically different. A user who needs a drill Feb 10–12 but whose request expires Feb 20 won't get the right reminder.

**Fix:** Change `neededUntil` to `expiresAt` in the scheduler query.
**Status:** Fixed — scheduler query now uses `expiresAt` field.

---

## High

### B-10: ~~No password validation on register~~ ✅ FIXED
**File:** `authController.js` (lines 12–33)
**Impact:** Accepts empty/undefined passwords; potential runtime error on hash

**Fix:** Require minimum 8 characters, validate type is string.
**Status:** Fixed — added `.matches(/[A-Z]/)` and `.matches(/[0-9]/)` validators in authRoutes.js.

**Estimated Effort:** Small (~2K tokens, ~5 min)
**Dependencies:** None

---

### B-11: ~~No token invalidation on logout~~ ✅ FIXED (simplified)
**File:** `authMiddleware.js` / `AuthContext.tsx`
**Impact:** Stolen tokens remain valid until expiration; client-only logout is security theater

Backend has no logout endpoint. Frontend just clears localStorage.

**Fix:** Implement token blacklist table or short-lived access tokens with refresh token rotation.
**Status:** Fixed (simplified) — token expiry shortened from 7d to 24h in jwt.js; added `isLoggingOut` flag in client.ts to prevent 401 redirect during intentional logout. Full refresh token rotation deferred.

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs) — new Prisma model, migration, middleware check, backend endpoint, frontend integration
**Dependencies:** Prisma migration. If using Redis for blacklist: `redis` / `ioredis` npm package

---

### B-12: ~~Complex OR/AND query logic in item search may produce incorrect WHERE clauses~~ ✅ FIXED
**File:** `itemController.js` (lines 176–209)
**Impact:** Items could be incorrectly included/excluded from search results

The WHERE clause restructuring when combining `availableFrom` with search is overly complex and fragile.

**Fix:** Build conditions systematically using an `AND` array of independent conditions.
**Status:** Fixed — refactored to always-use `AND[]` pattern in itemController.js, eliminating fragile OR/AND restructuring.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### B-13: ~~No date order validation for requests~~ ✅ FIXED
**File:** `requestController.js` (lines 62–63)
**Impact:** Requests with `neededFrom > neededUntil` can be created, breaking matching logic

**Fix:** Validate `neededFrom < neededUntil` and both are valid dates.
**Status:** Fixed — added `.custom()` validators: neededFrom rejects past dates, neededUntil must be after neededFrom.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-14: ~~Budget tier comparison ignores rental duration in matching~~ ✅ FIXED
**File:** `matching.js` (lines 331–339)
**Impact:** Items incorrectly included/excluded from matches based on per-unit rate vs. total cost confusion

**Fix:** Use `estimateRentalCost()` to compare total estimated cost against budget.
**Status:** Fixed — both `findMatchesForRequest` and `findRequestsForItem` now use `estimateRentalCost()` for maxBudget fallback.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None — `estimateRentalCost()` already exists in the same file

---

### B-15: ~~Scheduler notification deduplication query may fail~~ ✅ FIXED
**File:** `schedulerService.js` (lines 258–270)
**Impact:** JSON path filtering with `data.path` syntax is database-specific and may crash the scheduler

**Fix:** Add explicit `transactionId` field to Notification model for reliable querying.
**Status:** Fixed — replaced JSON path queries with `userId + type + createdAt` range queries, filtering by transactionId/requestId in JS.

**Estimated Effort:** Medium (~10K tokens, ~30 min) — schema change, migration, update notificationService + scheduler queries
**Dependencies:** Prisma migration

---

### B-16: ~~Frontend API client destroys error context~~ ✅ FIXED
**File:** `good-neighbors-web/src/api/client.ts` (lines 29–38)
**Impact:** Components can't distinguish 400 vs. 403 vs. 500; validation details lost

The interceptor reduces all errors to a plain `Error(message)`, discarding status code, error code, and validation details.

**Fix:** Create an `ApiError` class that preserves status, code, and details array.
**Status:** Fixed — created `ApiError` class with `status`, `code`, `details` fields in client.ts.

**Estimated Effort:** Small (~5K tokens, ~15 min) — new class + update interceptor + update a few catch blocks
**Dependencies:** None

---

### B-17: ~~No token refresh — immediate logout on any 401~~ ✅ FIXED (simplified)
**File:** `good-neighbors-web/src/api/client.ts` (lines 20–28)
**Impact:** Users lose all in-progress work when token expires; poor UX

**Fix:** Implement refresh token flow with request queuing during refresh.
**Status:** Fixed (simplified) — shortened token to 24h, added `isLoggingOut` flag. Full refresh token rotation deferred.

**Estimated Effort:** Large (~35K tokens, ~2 hrs) — backend refresh endpoint + frontend interceptor queue + AuthContext changes
**Dependencies:** Backend needs refresh token model (Prisma migration). Overlaps with B-11.

---

### B-18: ~~Floating-point precision in financial calculations (both frontend and backend)~~ ✅ FIXED
**Files:** `feeCalculation.js` (line 96), `feeEstimate.ts` (lines 154–173)
**Impact:** Rounding errors accumulate across `toFixed(2)` → `parseFloat()` chains; potential penny discrepancies in billing

**Fix:** Use integer cents for all intermediate calculations, or use a decimal library.
**Status:** Fixed — all fee outputs (platformFee, borrowerPlatformFee, depositAmount, insuranceFee, totalCharged) rounded to 2 decimals via `parseFloat((...).toFixed(2))`. lenderPlatformFee derived from subtraction to avoid penny discrepancies.

**Estimated Effort:** Medium (~15K tokens, ~45 min) — refactor both fee files + update all callers
**Dependencies:** Option A (cents): None. Option B: `decimal.js` npm package (~12KB)

---

### B-19: ~~Unsafe type casting of `item.details` in ItemDetail~~ ✅ FIXED
**File:** `ItemDetail.tsx` (line 229)
**Impact:** Runtime crash if backend changes the structure of `details`

Double-casts `details` to `Record<string, unknown>` then to `Record<string, number>` without runtime validation.

**Fix:** Use Zod schema validation before accessing `pricingTiers`.
**Status:** Fixed — replaced `(item.details as Record<string, unknown>)?.pricingTiers as Record<string, number>` with `item.details?.pricingTiers` (type already defined on ItemDetails).

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** `zod` already in project

---

### B-20: ~~Dashboard uses `||` instead of `??` for averageRating~~ ✅ FIXED
**File:** `Dashboard.tsx` (lines 420–426)
**Impact:** A legitimate `0` rating is treated as falsy, triggering the fallback calculation

**Fix:** Use nullish coalescing (`??`) instead of logical OR (`||`).
**Status:** Fixed — changed `||` to `??` for averageRating.

**Estimated Effort:** Trivial (~1K tokens, ~2 min)
**Dependencies:** None

---

## Medium

### B-21: ~~`return_confirmed` status missing from BLOCKING_STATUSES~~ ✅ NOT A BUG
**File:** `dateConflict.js` (line 7)
**Impact:** Calendar shows false availability for dates where a return was just confirmed but transaction isn't completed yet

**Status:** Not a bug — `return_confirmed` correctly should NOT be in BLOCKING_STATUSES since the item is physically returned and available for new bookings.

**Estimated Effort:** Trivial (~1K tokens, ~2 min)
**Dependencies:** None

---

### B-22: ~~CORS allows all origins~~ ✅ FIXED
**File:** `server.js` (line 24) — `app.use(cors())`
**Impact:** Any website can make authenticated requests to the API

**Fix:** Restrict to `process.env.CORS_ORIGINS` or `'http://localhost:5173'`.
**Status:** Fixed — CORS restricted to `CORS_ORIGIN` env var (done in I-03).

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-23: ~~No request body size limit~~ ✅ FIXED
**File:** `server.js` (line 25) — `app.use(express.json())`
**Impact:** Large payloads could cause memory exhaustion

**Fix:** Add `{ limit: '10kb' }`.
**Status:** Fixed — Body size limit set to 1MB (done in I-03).

**Estimated Effort:** Trivial (~1K tokens, ~2 min)
**Dependencies:** None

---

### B-24: ~~Text spec fields subtract weight from total, inflating scores~~ ✅ FIXED
**File:** `matching.js` (lines 218–223)
**Impact:** Items with many text-type specs get artificially inflated match scores

When a spec is type `text`, `totalWeight -= weight` is called, reducing the denominator and inflating the final percentage.

**Fix:** Don't subtract weight for text fields.
**Status:** ✅ FIXED — Removed `totalWeight -= weight` from the text case in `calculateSpecScore`, so text specs no longer inflate other scores.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-25: ~~`estimateRentalCost` returns cost 0 when all pricing is invalid~~ ✅ FIXED
**File:** `matching.js` (lines 520–525)
**Impact:** Items with broken pricing data appear "free" in match scoring

If `bestCost` stays at `Infinity`, the function returns `{ cost: 0 }`.

**Fix:** Return `null` to signal inability to calculate, and handle null in callers.
**Status:** ✅ FIXED — Returns `null` instead of `{ cost: 0 }` when Infinity; updated 3 call sites to handle null.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-26: ~~Race condition in `cancelRequest` — check-then-act~~ ✅ FIXED
**File:** `requestController.js` (lines 206–212)
**Impact:** Request status could change between findUnique and update

**Fix:** Use `prisma.$transaction()`.
**Status:** ✅ FIXED — Wrapped cancelRequest in `prisma.$transaction()` to eliminate TOCTOU race condition.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-27: ~~No check before deleting item with active transactions~~ ✅ FIXED
**File:** `itemController.js` (lines 482–486)
**Impact:** Soft-deleting an item while it's actively being borrowed confuses the borrower

**Status:** ✅ FIXED — Counts active transactions before soft-delete; returns 409 Conflict if any exist.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-28: ~~Message controller queries transaction twice~~ ✅ NOT A BUG
**File:** `messageController.js` (lines 13 and 47)
**Impact:** Unnecessary database round-trip; minor performance issue

**Status:** Not a bug — Two transaction queries are intentional (first for auth check, second includes item for notification context). Merging would over-fetch for the auth path.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-29: ~~Race condition in duplicate rating check~~ ✅ FIXED
**File:** `ratingController.js` (lines 48–59)
**Impact:** Two ratings from same user could be created simultaneously

**Fix:** Add database unique constraint `@@unique([transactionId, raterId])`.
**Status:** Fixed — `@@unique([transactionId, raterId])` constraint exists + `$transaction` wrapper.

**Estimated Effort:** Small (~2K tokens, ~10 min) — schema change + migration + error handling
**Dependencies:** Prisma migration

---

### B-30: ~~`getNearbyDemand` doesn't exclude requests user already declined~~ ✅ FIXED
**File:** `insightsController.js` (lines 59–73)
**Impact:** Users see stale demand signals for requests they already passed on

**Status:** ✅ FIXED — Filters out declined requestIds from getNearbyDemand results.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-31: ~~Missing pagination/limit validation across controllers~~ ✅ FIXED
**Files:** `itemController.js`, `requestController.js`, `notificationController.js`, `insightsController.js`
**Impact:** Negative or huge values for `limit`/`offset` accepted without clamping

**Fix:** `Math.min(Math.max(parseInt(limit) || 20, 1), 100)`.
**Status:** ✅ FIXED — Clamped limits (1-100) and offsets (>=0) in 6 controllers.

**Estimated Effort:** Small (~3K tokens, ~10 min) — same 1-liner in ~6 files
**Dependencies:** None

---

### B-32: ~~NotificationItem missing navigation paths for several notification types~~ ✅ FIXED
**File:** `NotificationItem.tsx` (lines 75–100)
**Impact:** Clicking notifications for `transaction_active`, `return_reminder`, `approval_reminder`, etc. does nothing

**Status:** Fixed — NotificationItem has comprehensive navigation paths for all types.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-33: ~~Multiple 401 responses cause concurrent logout race~~ ✅ FIXED
**File:** `client.ts` (lines 20–28)
**Impact:** Multiple simultaneous 401s all try to redirect, creating duplicate history entries

**Fix:** Add `isLoggingOut` flag or implement proper token refresh.
**Status:** Fixed — `_isLoggingOut` flag prevents concurrent 401 redirect race (done in B-17).

**Estimated Effort:** Trivial (~2K tokens, ~5 min) for flag; Large for full token refresh (see B-17)
**Dependencies:** None for flag approach

---

### B-34: ~~User state deserialized from localStorage without validation~~ ✅ FIXED
**File:** `AuthContext.tsx` (lines 40–53)
**Impact:** Corrupted or manually-edited localStorage could set a malformed user object, causing downstream crashes

**Fix:** Validate parsed object has required fields (id, email, firstName, lastName) before calling `setUser`.
**Status:** Fixed — Zod schema validation on localStorage user (done in I-08).

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None (or `zod` if using schema validation)

---

### B-35: ~~SpecsForm required fields not enforced on submission~~ ✅ FIXED
**File:** `SpecsForm.tsx` (lines 15–85)
**Impact:** Required spec fields show `*` indicator but form can be submitted without filling them

**Status:** ✅ FIXED — Queries spec definitions and checks required specs in onSubmit (CreateItem, EditItem, CreateRequest).

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### B-36: ~~CategorySelector allows submission without completing all 3 tiers~~ ✅ FIXED
**File:** `CategorySelector.tsx` (lines 80–139)
**Impact:** Items/requests can be created with incomplete category selection

**Status:** ✅ FIXED — Added tier-specific validation messages in 3 form pages (CreateItem, EditItem, CreateRequest).

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### B-37: ~~Inconsistent notification preference defaults~~ ✅ FIXED
**File:** `notificationController.js` (lines 153–162)
**Impact:** Create and get endpoints use different defaults

**Status:** Fixed — Notification preference defaults are consistent across create and get endpoints.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-38: ~~Platform fee split return structure is ambiguous~~ ✅ FIXED
**File:** `feeCalculation.js` (lines 90–93)
**Impact:** Callers could accidentally double-count fees by adding `platformFee` + `borrowerPlatformFee`

**Status:** Fixed — Fee return structure is unambiguous with separate `borrowerPlatformFee`/`lenderPlatformFee`.

**Estimated Effort:** Small (~5K tokens, ~15 min) — restructure return object + update all callers
**Dependencies:** None

---

## Low

### B-39: ~~Hardcoded 48-hour request expiration~~ ✅ FIXED
**File:** `requestController.js` (lines 52–54)
**Impact:** Not configurable per use case

**Fix:** Changed `expiresAt` to default to `null` (no expiration) instead of hardcoded 48 hours. User can optionally pass `expiresAt` in request body.
**Status:** Fixed — requests no longer auto-expire by default.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-40: ~~Match score rounding inconsistency (1 decimal vs integer)~~ ✅ FIXED
**File:** `matching.js` (line 677)
**Fix:** Changed `Math.round(score)` to `Math.round(score * 10) / 10` for consistent 1-decimal precision across all match scores.

**Estimated Effort:** Trivial (~1K tokens, ~2 min)
**Dependencies:** None

---

### B-41: ~~Deposit and insurance amounts not rounded to 2 decimals~~ ✅ FIXED
**Files:** `Transactions.tsx`, `ItemDetail.tsx`
**Fix:** Rounded `calculateNetAmount` return values with `parseFloat(toFixed(2))` to prevent floating-point accumulation. Formatted `replacementValue` display with `.toFixed(2)`. Rounded `totalEstimate` after insurance addition.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-42: ~~Price format inconsistency (`$20/day` vs `$20 / day`)~~ ✅ FIXED
**Files:** `MyListings.tsx`
**Impact:** Inconsistent user experience

**Fix:** Standardized `formatPricing()` in MyListings.tsx to use `Number.isInteger()` for safe formatting — both tier display and fallback single-rate now use consistent `$X` / `$X.XX` format.

---

### B-43: ~~`formatPrice` uses modulo which fails with floats~~ ✅ FIXED
**File:** `PricingSuggestions.tsx` (line 38)
**Impact:** `10.1 % 1` returns `0.0999...` instead of `0.1`; wrong formatting branch taken

**Fix:** Replaced `price % 1 === 0` with `Number.isInteger(price)` for float-safe check.

---

### B-44: ~~Click-outside handler on NotificationBell could double-trigger~~ ✅ FIXED
**File:** `NotificationBell.tsx`
**Fix:** Changed useEffect to only attach the click-outside listener when `isOpen` is true, preventing unnecessary event handling.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-45: ~~Timezone issues in date-only displays~~ ✅ FIXED
**Files:** `RequestDetail.tsx`, `MyRequests.tsx`, `ItemDetail.tsx`, `Matches.tsx`, `Neighborhood.tsx`, `MyListings.tsx`, `dateFormat.ts` (new)
**Impact:** Date-only fields (neededFrom, neededUntil, availableFrom, availableUntil) stored as UTC midnight displayed one day behind in US timezones (e.g., March 5 UTC midnight = March 4 at 7pm EST)

**Fix:** Added `timeZone: 'UTC'` to all `toLocaleDateString()` calls for date-only fields across 6 pages. Created `src/utils/dateFormat.ts` with `formatDateOnly()` utility that enforces UTC. Backend `isAvailableForDates()` also uses UTC methods (`getUTCDay`, `setUTCHours`, `setUTCDate`).
**Status:** Fixed — all date-only displays use UTC timezone; datetime fields (createdAt, pickupTime with time component) remain in local timezone.

---

### B-46: ~~Fee estimation off-by-one: daily duration counts exclusive days~~ ✅ FIXED
**Files:** `feeCalculation.js` (backend), `feeEstimate.ts` (frontend)
**Impact:** Feb 27–28 rental shows "1 day x $40 = $40" instead of "2 days x $40 = $80". Both frontend and backend used `Math.ceil(diffMs / msPerDay)` which doesn't count dates inclusively — a diff of exactly 24h = 1.0, `Math.ceil(1.0) = 1`.

**Fix:** Changed daily/weekly/monthly tiers to use inclusive calendar day counting: `const inclusiveDays = Math.floor(diffMs / msPerDay) + 1`. Hourly tier unchanged (uses exact hour diff). Weekly = `Math.ceil(inclusiveDays / 7)`, monthly = `Math.ceil(inclusiveDays / 30)`.
**Status:** Fixed in both frontend and backend.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-47: ~~Security deposit misleadingly included in total cost~~ ✅ FIXED
**Files:** `TransactionDetail.tsx`, `RequestDetail.tsx` (confirm modal)
**Impact:** Deposit (a refundable temporary hold) was rolled into "Total You Pay", making it look like an actual charge. Misleading to users.

**Fix:** Removed deposit from total sum. Deposit now shown as separate blue info callout below total: active transactions show "Temporary hold — refunded after return"; completed/cancelled show "Refunded" with strikethrough. Confirm modal also shows deposit separately with explanatory text.
**Status:** Fixed.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-48: ~~Transaction creation blocked for pending matches~~ ✅ FIXED
**File:** `transactionController.js` (line 50)
**Impact:** Backend required `match.lenderResponse === 'accepted'` before creating a transaction. When borrower clicked "Confirm & Borrow" on a pending match, they got error "Match has not been accepted by the lender" even though the flow should allow it.

**Fix:** Changed validation to only block `declined` matches. Pending matches are auto-accepted when borrower confirms. Transaction still starts as `requested` status so lender must accept the transaction itself.
**Status:** Fixed.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-49: ~~UTC timezone bug causes requests to appear in both Open and Unfulfilled~~ ✅ FIXED
**Files:** `MyRequests.tsx`, `RequestDetail.tsx`, `schedulerService.js`
**Impact:** Requests whose start date was tomorrow UTC but "today" in US western timezones would appear in both Open and Unfulfilled sections simultaneously. `new Date('2026-02-13T00:00:00Z')` resolves to Feb 12 5pm in MST.

**Fix:** Created `todayUTC()` helper using `Date.UTC()` for calendar-date-only comparison. Replaced independent filter functions with cascading single-pass loop (Fulfilled > Active > Open > Unfulfilled). Fixed scheduler to use start-of-today UTC.
**Status:** Fixed.

---

### B-50: ~~Unable to delete requests — missing backend DELETE endpoint~~ ✅ FIXED
**Files:** `requestController.js`, `requestRoutes.js`, `MyRequests.tsx`
**Impact:** Frontend called `DELETE /api/requests/:id` but backend had no handler — silent 404. Delete button also only showed for cancelled/expired statuses.

**Fix:** Added `deleteRequest` controller with ownership check, active transaction guard, cascading delete (matches then request). Added DELETE route. Frontend: delete button now shows on all non-active cards; cancel shows for open+matched.
**Status:** Fixed.

---

### B-51: ~~Spec scoring division by zero in matching algorithm~~ ✅ FIXED
**File:** `matching.js` (line 153)
**Impact:** For number fields, uses `Math.exp(-overBy / (flexibility || 1))`. If `flexibility = 0`, the fallback of `1` isn't triggered because `0` is falsy only to `||` but the real issue is that `flexibility` could be `0` intentionally for exact-match specs. For multi-select scoring (line 205), `intersection.length / reqArr.length` divides by zero if array is empty.

**Fix:** Change to `flexibility || 0.1` for number fields. Add `if (reqArr.length === 0) return 1.0` for multi-select.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-52: ~~Any authenticated user can view any request's full details + matches~~ ✅ FIXED
**File:** `requestController.js` (getRequest, line 95-162)
**Impact:** No authorization check — any authenticated user can see any request's matches, budget, location, and specs by calling `GET /api/requests/:id`. Privacy violation for requesters.

**Fix:** Restrict full match visibility to the request owner. Show limited info (title, category, dates) to other users.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-53: ~~Race condition in request deletion — transaction could be created between check and delete~~ ✅ FIXED
**File:** `requestController.js` (deleteRequest)
**Impact:** Between the active transaction count check and the cascade delete, a new transaction could be created for the request's matches.

**Fix:** Wrap the entire check + delete in `prisma.$transaction()` with serializable isolation.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-54: ~~Borrow modal shows date conflict only after form submission~~ ✅ FIXED
**File:** `ItemDetail.tsx` (line 107-115)
**Impact:** User picks dates, fills protection, clicks submit — then sees "dates conflict" error. Should show conflict immediately as dates are selected.

**Fix:** Run `isAvailableForDates()` check on date change (debounced) and show inline warning before submit button.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### B-55: ~~Match accept mutation doesn't navigate or show confirmation~~ ✅ ALREADY IMPLEMENTED
**File:** `Matches.tsx` (line 34-39)
**Impact:** Lender clicks "Accept", toast shows, but stays on Matches page with stale card. Should navigate to the created transaction or show confirmation modal.

**Fix:** On accept success, navigate to `/transactions/{transactionId}` or show modal with next steps.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-56: ~~CreateItem photo upload is non-functional placeholder~~ ✅ FIXED
**File:** `CreateItem.tsx` (line 619-627)
**Impact:** Dashed border with "coming soon" text — users cannot add photos to listings. Critical for a marketplace app.

**Fix:** Implemented local file upload with multer backend + drag-and-drop PhotoUpload component. Backend `POST /api/uploads` stores files to `uploads/` dir, frontend component handles drag-drop, preview, remove. Integrated into CreateItem and EditItem.
**Status:** Fixed — local disk storage (cloud storage upgrade tracked as M-01).

---

### B-57: ~~Missing `pickupTime < returnTime` validation in transaction creation~~ ✅ FIXED
**File:** `transactionController.js` (lines 24-31)
**Impact:** No validation that pickup is before return. Could create logically impossible transactions.

**Fix:** Add `.custom()` validator in route, or check in controller before creating.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-58: ~~CreateRequest location requirement blocks form too early~~ ✅ FIXED
**File:** `CreateRequest.tsx` (line 307-343)
**Impact:** User must set location before even describing what they need. Frustrating for users who want to explore the form first. Location is only needed at submission.

**Fix:** Move location check to final step or submission validation. Allow users to browse categories and enter details first.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### B-59: ~~TransactionDetail message input has no validation, char limit, or send feedback~~ ✅ FIXED
**File:** `TransactionDetail.tsx` (line 447-456)
**Impact:** No max length, no success/error feedback on send, no character count indicator. Messages could be arbitrarily long.

**Fix:** Add max length (2000 chars), character counter, and toast on send success/failure.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-60: ~~Notification dropdown lacks ARIA roles for accessibility~~ ✅ FIXED
**Files:** `NotificationBell.tsx`, `Modal.tsx`, `Tabs.tsx`
**Impact:** Screen readers can't identify dropdowns as menus, modals as dialogs, or tabs as tab panels. Violates WCAG 2.1 AA.

**Fix:** Add `role="menu"` + `aria-haspopup` to NotificationBell dropdown, `role="dialog"` + `aria-labelledby` to Modal, `role="tablist"` + `role="tab"` + `aria-selected` to Tabs.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### B-61: ~~No top-level ErrorBoundary for public routes~~ ✅ FIXED
**File:** `App.tsx`
**Impact:** ErrorBoundary only wraps ProtectedRoute children. Public pages (Landing, Login, Register, Neighborhood) crash to white screen on unhandled errors.

**Fix:** Wrap entire `<Routes>` or `<BrowserRouter>` contents in ErrorBoundary.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-62: ~~Action Center can overflow with no pagination~~ ✅ FIXED (redesigned)
**File:** `Dashboard.tsx` → `ActionCenterSummary.tsx` + `/action-center` page
**Impact:** If user has 20+ active transactions/matches, Action Center becomes extremely tall. No "show more" or pagination — user must scroll past everything.

**Fix:** Replaced full card list with compact summary widget on Dashboard (shows actionable text like "2 need response, 1 due soon"). Click through to dedicated `/action-center` page for full card list with All/Lending/Borrowing tabs. Dashboard never shows individual action cards anymore.

**Estimated Effort:** ~~Small~~ Large (~50K tokens, ~2 hrs) — full redesign with hook extraction, shared components, new page
**Dependencies:** None

---

### B-63: ~~History transactions don't show "Leave Review" button~~ ✅ FIXED
**File:** `Transactions.tsx` (line 495-502)
**Impact:** Completed transactions in history section have no quick action to leave a rating. Forces user to click through to detail page.

**Fix:** Add "Rate" quick action button for completed transactions where user hasn't rated yet.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-64: ~~Neighborhood demand tab date labels are misleading~~ ✅ FIXED
**File:** `Neighborhood.tsx` (line 373-375)
**Impact:** Both Supply and Demand tabs show "Needed From/Until" labels, but Supply items filter by `availableFrom/Until` (lender availability). Confusing semantics.

**Fix:** Supply tab: "Available From/Until". Demand tab: "Needed From/Until".

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### B-65: ~~Profile email change has no verification~~ ✅ FIXED
**File:** `Profile.tsx` (line 165)
**Impact:** User can change email to anything with no verification. Could lock themselves out of account with a typo.

**Fix:** Backend now requires `currentPassword` when email is being changed. Frontend conditionally shows password field when email differs from current. Also checks for email uniqueness. Full email verification (confirmation link) deferred to M-16.
**Status:** Fixed — password-gated email changes.

---

### B-66: ~~No 404 page for undefined routes~~ ✅ FIXED
**File:** `App.tsx`
**Impact:** Users navigating to `/nonexistent` see blank page. No feedback that URL is invalid.

**Fix:** Add `<Route path="*" element={<NotFound />} />` catch-all.

**Estimated Effort:** Trivial (~2K tokens, ~5 min)
**Dependencies:** None

---

### B-67: ~~getMyItems returns all items without pagination~~ ✅ FIXED
**File:** `itemController.js` (lines 511-525)
**Impact:** If user has hundreds of listings, all are returned in one query. Performance degrades as listing count grows.

**Fix:** Add `limit`/`offset` params with default limit of 50.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### B-68: ~~Matching N+1 query — fetches all ratings with each item~~ ✅ FIXED
**Files:** `matchController.js`, `requestController.js`
**Impact:** `getIncomingMatches` and `getRequest` include `owner.ratingsReceived` for each matched item. For many items, this loads thousands of rating records. Performance bottleneck.

**Fix:** Replaced with `_count` include + batch `prisma.rating.groupBy()` for averages. Single aggregate query instead of fetching all rating records.

**Estimated Effort:** Medium (~10K tokens, ~30 min)
**Dependencies:** None

---

### B-69: ~~getIncomingMatches has no limit/offset bounds~~ ✅ FIXED
**File:** `matchController.js` (lines 236-237)
**Impact:** Uses raw `parseInt` on limit/offset without `Math.min`/`Math.max` bounds. Client could request 10,000 records.

**Fix:** Clamp limit to 1-100, offset to >=0 (same pattern as other controllers).

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

---

# 2. Improvements

## High Priority

### I-01: ~~Wrap critical state changes in `prisma.$transaction()`~~ ✅ DONE
**Files:** `matchController.js`, `transactionController.js`, `ratingController.js`, `requestController.js`
**Why:** Multiple controllers use check-then-act patterns where state can change between the check and the action. Database transactions prevent race conditions.
**Status:** Done — `createTransaction`, `submitRating`, and `respondToMatch` accept path wrapped in `prisma.$transaction()`. Notifications sent outside transactions.

**Estimated Effort:** Medium (~15K tokens, ~45 min) — 4 controllers, each needs refactoring of 1–2 functions
**Dependencies:** None

---

### I-02: ~~Add input validation across all endpoints~~ ✅ DONE
**Files:** All controllers
**Why:** Most endpoints lack validation for: date order, number ranges, email format, phone format, string length, lat/lng bounds, enum values. This is the single largest category of issues.

**Recommended approach:** Use a validation middleware (e.g., `express-validator` or `zod`) to validate request bodies before they reach controller logic.
**Status:** Done (targeted) — added `param('id').isUUID()` to all `:id` routes across items, requests, transactions, users, matches, notifications. Notification routes fully wrapped with express-validator + handleValidationErrors + asyncHandler.

**Estimated Effort:** Large (~40K tokens, ~2 hrs) — systematic validation for ~30 endpoints
**Dependencies:** `express-validator` or `zod` npm package (express-validator likely already partially in use via route files)

---

### I-03: ~~Add rate limiting on auth and spam-prone endpoints~~ ✅ DONE
**Files:** Auth routes, message creation, match creation
**Why:** No protection against brute force login attempts or message spam.

**Fix:** `express-rate-limit` on `/auth/login`, `/auth/register`, and `/messages`.
**Status:** Done — `express-rate-limit` (10 req/15min) on `/api/auth/login` and `/api/auth/register`. Body size limit: `express.json({ limit: '1mb' })`. CORS restricted to `process.env.CORS_ORIGIN || 'http://localhost:5173'`.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** `express-rate-limit` npm package

---

### I-04: ~~Create structured `ApiError` class in frontend~~ ✅ DONE
**File:** `client.ts`
**Why:** Currently all API errors are reduced to `Error(message)`. Components need status codes and validation details to show appropriate UI.
**Status:** Done — merged with B-16.

```ts
class ApiError extends Error {
  status?: number;
  code?: string;
  details?: any[];
}
```

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### I-05: ~~Add database unique constraints for data integrity~~ ✅ ALREADY DONE
**File:** `prisma/schema.prisma`
**Why:** Prevents duplicate matches, duplicate ratings, and duplicate transactions at the DB level.

**Status:** Already implemented — Match has `@@unique([requestId, itemId])` (line 266), Rating has `@@unique([transactionId, raterId])` (line 388). Transaction has no `matchId` field so that constraint is N/A.

---

### I-06: ~~Add missing database indexes for query performance~~ ✅ DONE
**File:** `prisma/schema.prisma`
**Why:** Several high-traffic query patterns lack compound indexes.
**Status:** Done — added 5 indexes: Transaction(status,returnTime), Transaction(status,returnReminderSent), Transaction(status,overdueNotificationSent), Notification(userId,type,createdAt), Rating(ratedUserId,role). Migration applied.

```prisma
// Transaction
@@index([status, returnTime])
@@index([status, returnReminderSent])

// Notification
@@index([userId, type, createdAt])

// Rating
@@index([ratedUserId])
```

**Estimated Effort:** Small (~2K tokens, ~10 min)
**Dependencies:** Prisma migration

---

### I-07: ~~Consistent error handling in AuthContext login/register~~ ✅ DONE
**File:** `AuthContext.tsx` (lines 55–71)
**Why:** API call failures propagate as unhandled promise rejections, potentially crashing the app.

**Fix:** Wrap in try/catch, re-throw with clean message for component to handle.
**Status:** Done — login/register wrapped in try/catch that cleans up localStorage on failure, then re-throws.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### I-08: ~~Validate user object from localStorage on app load~~ ✅ DONE
**File:** `AuthContext.tsx` (lines 40–53)
**Why:** `JSON.parse(storedUser)` succeeds for any valid JSON, not just valid User objects. Corrupted data silently breaks the app.

**Fix:** Check required fields exist before calling `setUser()`.
**Status:** Done — added Zod schema (id, email, firstName, lastName) with `.passthrough()`. safeParse before setUser; clears storage if invalid.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

## Medium Priority

### I-09: Extract shared utility functions to reduce code duplication
**Files affected:**
- `CreateItem.tsx` / `EditItem.tsx` — 95% identical code → extract `<ItemForm />` *(still pending)*
- ~~`Dashboard.tsx` / `Transactions.tsx` — duplicate `statusVariants`, `statusLabels` → shared hook~~ *(completed in UI-03)*
- ~~`Dashboard.tsx` / `Transactions.tsx` — duplicate fee calculation logic → shared utility~~ *(savings feature deleted — duplicate functions removed from both files)*
- Multiple pages — duplicate date formatting → `formatDate()` / `formatDateRange()`

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs) — significant refactoring across many files
**Dependencies:** None
**Status:** Partially done — status dedup completed via UI-03; savings/fee duplicate functions removed (feature deleted). CreateItem/EditItem extraction and date formatting still pending.

---

### I-10: ~~Add loading skeletons instead of blank states~~ ✅ DONE
**Files:** All major pages now use shimmer skeletons instead of blank spinners.
**Fix:** Created `Skeleton` base component + page-specific skeletons (DashboardSkeleton, MyListingsSkeleton, NeighborhoodSkeleton, TransactionsSkeleton, MatchesSkeleton, ProfileSkeleton, ItemDetailSkeleton, TransactionDetailSkeleton, RequestDetailSkeleton). Replaced `LoadingPage` with layout-matched skeletons on ItemDetail, TransactionDetail, RequestDetail, Profile, and MyRatings pages.

---

### I-11: ~~Improve empty states with proper `<EmptyState />` component~~ ✅ DONE
**Files:** `Transactions.tsx` (lines 418–422), various list pages
**Why:** Some pages use inline text for empty states while others use the EmptyState component.

**Status:** ✅ DONE — Added variant prop (default/info/success/warning) to EmptyState component for contextual theming.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None — EmptyState component already exists

---

### I-12: ~~Add confirmation dialogs for destructive actions~~ ✅ DONE
**Files:** `MyRequests.tsx` (cancel request), `MyListings.tsx` (delete item), `TransactionDetail.tsx` (cancel transaction)
**Why:** No confirmation before irreversible actions.

**Status:** ✅ DONE — Created ConfirmDialog component, replaced `window.confirm` in MyListings, MyRequests, and TransactionDetail.

**Estimated Effort:** Small (~5K tokens, ~15 min) — reuse existing Modal component
**Dependencies:** None

---

### I-13: ~~Fix NotificationBell badge clearing too early~~ ✅ DONE
**File:** `NotificationBell.tsx`
**Fix:** Replaced immediate `markAsViewed()` on bell click with a 3-second delayed timer via `useEffect`. Timer auto-cancels if dropdown closes early. Badge persists until user has had time to see new notifications.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### I-14: ~~Add proxy error handling in Vite dev config~~ ✅ FIXED
**File:** `vite.config.ts`
**Why:** When backend is down, Vite shows a cryptic error. Adding an `onError` handler can return a helpful "Backend not running" message.

**Estimated Effort:** Small (~2K tokens, ~10 min)
**Dependencies:** None
**Status:** Fixed — added `configure` callback to Vite proxy. Returns 502 JSON response with helpful message when backend is unavailable; logs `[Proxy Error]` to console.

---

### I-15: ~~Export all API modules from `api/index.ts`~~ ✅ DONE
**File:** `api/index.ts`
**Fix:** Added exports for `notificationsApi`, `insightsApi`, and all `categories` module exports (`export *`).

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### I-16: ~~Add adaptive retry logic to React Query~~ ✅ FIXED
**File:** `App.tsx` (lines 30–37)
**Why:** Global `retry: 1` is too aggressive. 4xx errors shouldn't retry at all; 5xx errors should retry with exponential backoff.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None — React Query has built-in retry function support
**Status:** Fixed — replaced fixed `retry: 1` with adaptive function: never retries 4xx, retries up to 2x for 5xx/network errors with exponential backoff (`retryDelay: min(1000 * 2^attempt, 10000)`).

---

### I-17: ~~Add error boundary around protected routes~~ ✅ DONE
**Files:** `ProtectedRoute.tsx`, `ErrorBoundary.tsx`
**Fix:** Already implemented — ProtectedRoute wraps children in ErrorBoundary with `key={location.pathname}` (auto-resets on navigation). ErrorBoundary shows "Something went wrong" with Try Again + Reload buttons, plus dev-mode error details.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### I-18: ~~Limit CategorySelector search results to prevent DOM thrashing~~ ✅ DONE
**File:** `CategorySelector.tsx`
**Fix:** Sliced suggestions to max 15 items. Shows "X more results — refine your search" indicator when results exceed the limit.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

## Low Priority

### I-19: Use path aliases (`@/`) consistently
**File:** `tsconfig.json` defines `@/*` → `src/*` but no component uses it.

**Estimated Effort:** Medium (~10K tokens, ~30 min) — bulk find-and-replace across ~50 files + verify Vite resolves correctly
**Dependencies:** May need `vite-tsconfig-paths` plugin if not already configured

---

### I-20: ~~Standardize named vs. default imports for `apiClient`~~ ✅ FIXED
**Files:** Various API files use inconsistent import patterns.

**Estimated Effort:** Trivial (~2K tokens, ~5 min)
**Dependencies:** None
**Status:** Fixed — `categories.ts` changed `import api` to `import apiClient` (updated all 8 usages); `notifications.ts` changed named import to default import. All 8 API files now consistently use `import apiClient from './client'`.

---

### I-21: ~~Add complete notification navigation paths~~ ✅ DONE
**File:** `NotificationItem.tsx`
**Fix:** Added navigation paths for 6 missing types: `transaction_active`, `return_reminder`, `transaction_overdue` → transaction detail; `request_expired`, `request_expiring` → request detail; `approval_reminder` → matches. Also added contextual icons for each (lightning bolt, clock, warning, etc.).

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### I-22: ~~Type pagination responses instead of `unknown`~~ ✅ FIXED
**Files:** `types/index.ts`, `requests.ts`, `transactions.ts`, `messages.ts`, `users.ts`, `notifications.ts`
**Why:** `pagination: unknown` defeats TypeScript benefits. Create shared `PaginationMeta` type.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None
**Status:** Fixed — created `PaginationMeta` interface (`total`, `limit`, `offset`) in `types/index.ts`, refactored `PaginatedResponse<T>` to use it. Replaced `pagination: unknown` with `pagination: PaginationMeta` in 5 API files. Updated `notifications.ts` to use `PaginationMeta` instead of inline type.

---

### I-23: ~~Remove `optionalAuth` silent failure~~ ✅ FIXED
**File:** `authMiddleware.js` (lines 44–68)
**Why:** When optional auth fails, no logging occurs, making debugging hard.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None
**Status:** Fixed — changed silent `catch` block to `console.warn('[optionalAuth] Invalid token ignored: ${error.name} — ${error.message}')` for debuggability.

---

### I-24: ~~Standardize star rating display for accessibility~~ ✅ DONE
**File:** `StarRating.tsx`
**Fix:** Already implemented — StarRating component uses `role="img"` and `aria-label={`${rating} out of ${maxStars} stars`}`. No inline `'★'.repeat()` characters remain anywhere in the codebase.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### I-25: ~~Improve phone number display timing in TransactionDetail~~ ✅ DONE
**File:** `TransactionDetail.tsx`
**Fix:** Extended phone number visibility to include `return_confirmed` and `completed` statuses in addition to existing active states.

**Estimated Effort:** Trivial (~1K tokens, ~5 min)
**Dependencies:** None

---

### I-26: ~~Clean up localStorage keys on logout~~ ✅ DONE
**File:** `AuthContext.tsx`
**Fix:** Added cleanup loop in `logout()` that removes all keys starting with `notifications_last_viewed_`, `draft_`, or `draft_state_` before clearing user state and query cache.

**Estimated Effort:** Trivial (~2K tokens, ~5 min)
**Dependencies:** None

---

### I-27: ~~Redesign Action Center from role labels to role-based sub-sections~~ ✅ DONE (further redesigned)
**File:** `Dashboard.tsx` → `ActionCenterSummary.tsx`, `useActionCenter.ts`, `ActionCard.tsx`, `ActionCenter.tsx`
**Why:** Inline "LENDER"/"BORROWER" labels next to each Action Center card were confusing. Users couldn't quickly distinguish their items from their requests.

**Fix (v1):** Replaced flat urgency-sorted list with role-based sub-sections.
**Fix (v2 — current):** Further redesigned into compact dashboard summary with actionable text + dedicated /action-center page. Extracted ~350 lines into shared hook, components, and utility. Dashboard shows "Lending — 2 need response" / "Borrowing — 1 due soon" with click-through to full page. Full page has All/Lending/Borrowing tabs with all inline quick-action buttons.
**Status:** Done.

**Estimated Effort:** Medium (~15K tokens, ~30 min)
**Dependencies:** None

---

### I-28: ~~Streamline borrow flow from match cards~~ ✅ DONE
**Files:** `RequestDetail.tsx`
**Why:** Borrowing from a match required too many clicks: View Item → Request to Borrow → manually enter dates → submit. Dates were already known from the request.

**Fix:** Added "Confirm & Borrow" button directly on match cards. Pre-fills dates from request (9AM pickup, 5PM return), maps lender's protection preference to borrower selection, opens confirm modal with item summary, live fee estimate, deposit/insurance callouts, and editable dates/protection. Reduced flow from 5+ steps to 2 clicks.
**Status:** Done.

**Estimated Effort:** Large (~30K tokens, ~1 hr)
**Dependencies:** None

---

### I-29: ~~Add loading skeletons to all data-fetching pages~~ ✅ DONE
**Fix:** Completed via I-10 — all major data-fetching pages now have layout-matched skeleton loading states. 9 skeleton components total covering Dashboard, MyListings, Neighborhood, Transactions, Matches, Profile, ItemDetail, TransactionDetail, and RequestDetail.

---

### I-30: Move auth tokens from localStorage to HTTP-only cookies
**Files:** `client.ts`, `AuthContext.tsx`, backend auth routes
**Why:** localStorage tokens are vulnerable to XSS. Any injected script can steal the JWT. HTTP-only cookies prevent JavaScript access entirely.

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs) — backend cookie-setting, frontend removes token handling, CORS/CSRF updates
**Dependencies:** None

---

### I-31: Add "message before borrowing" option on item detail
**Files:** `ItemDetail.tsx`, potentially new message flow
**Why:** Users must commit to borrowing before they can message the owner. Pre-transaction questions ("Is this drill corded or cordless?", "Can I see more photos?") require workarounds.

**Estimated Effort:** Medium (~15K tokens, ~45 min) — "Ask a Question" button on ItemDetail, ties to direct messaging (A-17)
**Dependencies:** Direct messaging feature (A-17) or simple inquiry endpoint

---

### I-32: ~~Add real-time date conflict checking in borrow modal~~ ✅ FIXED
**Files:** `ItemDetail.tsx`, `RequestDetail.tsx`
**Why:** Date conflicts only shown after form submission. Users should see availability feedback immediately when selecting dates.

**Fix:** Run `isAvailableForDates()` check on date change (debounced) and show inline "Available" / "Dates conflict with existing booking" indicator.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### I-33: ~~Integrate error logging service for production~~ ✅ DONE
**Files:** `ErrorBoundary.tsx`, `errorHandler.js`, new `lib/sentry.ts`, `main.tsx`
**Why:** `componentDidCatch()` only logs to console. In production, errors are invisible. Need Sentry or similar for error tracking.

**Fix:** Installed `@sentry/react` + `@sentry/node`. Created `lib/sentry.ts` with conditional init (only when `VITE_SENTRY_DSN` / `SENTRY_DSN` env vars set, only in production). Wired ErrorBoundary to `captureException`. Backend errorHandler reports unexpected 500s to Sentry (skips expected Prisma/validation/auth errors).

**Estimated Effort:** Small (~5K tokens, ~15 min) — install Sentry SDK, wrap error boundary + backend error handler
**Dependencies:** `@sentry/react` (frontend), `@sentry/node` (backend), Sentry account (free tier)

---

### I-34: ~~Add route-based code splitting with React.lazy~~ DONE
**File:** `App.tsx`
**Why:** All pages bundled together. Initial load includes Dashboard, Transactions, CreateItem, etc. even for anonymous users. Lazy loading reduces initial bundle significantly.

**Estimated Effort:** Small (~5K tokens, ~15 min) — wrap each route component in `React.lazy()` + `<Suspense>`
**Dependencies:** None (built into React)

---

### I-35: ~~Improve Neighborhood filter UX with active filter breadcrumbs~~ DONE
**File:** `Neighborhood.tsx`
**Why:** When filtering by tier1 → tier2 → tier3, no breadcrumb shows the active filter path. Users can't easily see what filters are active or remove specific ones.

**Fix:** Show active filters as dismissible chips above results grid. "Category: Tools > Power Tools > Drill" [x]

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### I-36: ~~Add password change option to Profile~~ DONE
**File:** `Profile.tsx`, backend auth routes
**Why:** No way to change password from the profile page. Users must resort to reset flow (which doesn't exist either).

**Estimated Effort:** Medium (~10K tokens, ~30 min) — backend endpoint + frontend form section
**Dependencies:** None

---

### I-37: ~~Add fee preview to borrow modal~~ DONE
**File:** `ItemDetail.tsx`
**Why:** Users had to click "Send Request" blind — no cost information before committing. Now the borrow modal shows a full fee breakdown (rental fee, platform fee, tax, insurance, deposit) as soon as pickup/return dates are selected.

**Fix:** Added `estimateFees()` call with live cost preview between the protection type selector and the submit button. Shows all fee components with line-item breakdown, including deposit note.

---

### I-38: ~~Add active page indicator to navigation~~ DONE
**File:** `Header.tsx`
**Why:** Desktop and mobile nav had no active-page highlighting — users couldn't tell which page they were on. Both desktop links and mobile menu now highlight the active route with the primary color.

**Fix:** Added `useLocation` + `isActive()` helper. Desktop links get `text-primary-600` when active. Mobile nav items get `bg-primary-50 text-primary-700 font-medium` when active. Refactored mobile menu to data-driven array for consistency.

---

### I-39: ~~Add fee preview in borrow modal on RequestDetail~~ ✅ DONE
**File:** `RequestDetail.tsx`
**Fix:** Already implemented — the Confirm & Borrow modal includes full fee preview with rental breakdown, platform fee, tax, insurance, and deposit line items, matching the ItemDetail pattern.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** I-37

---

### I-40: ~~Add logout confirmation dialog~~ ✅ DONE
**File:** `Header.tsx`
**Fix:** Added ConfirmDialog with "Log out?" prompt on both desktop and mobile logout buttons. Uses existing ConfirmDialog component with danger variant.

**Estimated Effort:** Trivial (~2K tokens, ~5 min) — wrap logout in ConfirmDialog
**Dependencies:** None

---

### I-41: ~~Improve sort control visibility on Transactions/Neighborhood~~ ✅ DONE
**Files:** `Transactions.tsx`
**Fix:** Added "Sort by" label next to the select control with improved font weight and border styling for better discoverability.

**Estimated Effort:** Trivial (~2K tokens, ~5 min)
**Dependencies:** None

---

### I-42: ~~Auto-scroll to validation errors in CreateItem form~~ ✅ DONE
**Files:** `CreateItem.tsx`, `CreateRequest.tsx`
**Fix:** Added `scrollToError()` callback that finds the first visible `[role="alert"]` or `.text-red-600` element and scrolls to it smoothly. Called after every validation failure (category, specs, and Zod schema errors via `handleSubmit` error callback). Applied to both CreateItem and CreateRequest forms.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### I-43: ~~Add draft save indicator to CreateItem/CreateRequest~~ ✅ DONE
**Files:** `CreateItem.tsx`, `CreateRequest.tsx`, `useDraftForm.ts`
**Fix:** Added `lastSaved` timestamp state to `useDraftForm` hook. Both create forms now show "Draft saved [time]" in the button row when auto-save triggers.

**Estimated Effort:** Trivial (~2K tokens, ~5 min)
**Dependencies:** None

---

---

# 3. Additions

## High Value

### A-01: Token refresh flow
**Files:** Backend auth routes (new endpoint), `client.ts`, `AuthContext.tsx`
**Why:** Currently a token expiration = hard logout with no recovery. Standard practice is short-lived access tokens + refresh token rotation.

**Scope:**
- Backend: Add `POST /auth/refresh` endpoint + RefreshToken model
- Frontend: Intercept 401, attempt refresh, queue pending requests, retry on success

**Estimated Effort:** XL (~60K tokens, ~3 hrs) — new Prisma model, migration, backend endpoint, frontend interceptor with queue, AuthContext refactor
**Dependencies:** Prisma migration. Consider `uuid` for refresh token generation (likely already in project).

---

### A-02: Real-time updates / WebSocket support
**Files:** Backend server, frontend contexts
**Why:** Users must manually refresh to see updates (new messages, match responses, transaction state changes). Polling every 30–60s is a poor substitute.

**Minimum viable:** Server-Sent Events (SSE) for notifications. Full: WebSocket for messages + notifications.

**Estimated Effort:** XL (~80K tokens, ~4 hrs) for WebSocket; Large (~40K tokens, ~2 hrs) for SSE-only
**Dependencies:** SSE: None (native). WebSocket: `ws` or `socket.io` (backend) + `socket.io-client` (frontend). Socket.io adds ~45KB to frontend bundle.

---

### A-03: ~~Global toast notification system~~ ✅ DONE
**Files:** New `ToastContext.tsx`, integration across all mutation pages
**Why:** No centralized user feedback for actions. Each page handles success/error differently (or not at all).

**Examples:** "Item created successfully", "Match accepted — transaction created", "Request posted — neighbors will be notified"

**Status:** ✅ DONE — Installed `sonner`, added `<Toaster>` to App.tsx, wired `toast.success`/`toast.error` into mutations across 7 pages.

**Estimated Effort:** Medium (~15K tokens, ~45 min) — create context + component, wire into ~10 pages
**Dependencies:** `react-hot-toast` (~5KB) or `sonner` (~7KB) npm package, or build custom

---

### A-04: ~~Sorting and filtering on browse/list pages~~ ✅ DONE
**Files:** `Browse.tsx`, `Neighborhood.tsx`
**Why:** No way to sort by price, rating, distance, or newest. No price range filter.

**Scope:**
- Sort dropdown on Browse and Neighborhood (Supply tab) with options: Newest, Oldest, Price Low→High, Price High→Low, Title A-Z
- Min/max price range inputs wired to existing backend `sortBy`, `sortOrder`, `minPrice`, `maxPrice` query params
- All filter state persisted in URL search params

**Status:** ✅ DONE — Sort dropdown and price range filters implemented on Browse and Neighborhood pages.

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs) — backend `orderBy` support + frontend sort UI + optional price slider component
**Dependencies:** None for basic sort. Price slider: `@radix-ui/react-slider` or similar

---

### A-05: ~~Transaction audit log~~ ✅ DONE
**Files:** `prisma/schema.prisma` (new `TransactionAuditLog` model), `transactionController.js`
**Why:** No record of who changed a transaction status and when. Critical for dispute resolution and debugging.

**Implementation:** Added `TransactionAuditLog` model with fields: `id`, `transactionId`, `userId`, `fromStatus`, `toStatus`, `action`, `metadata` (JSON), `createdAt`. Audit entries are logged on transaction creation (`action: 'created'`) and every status change (`action: 'status_change'`, `'disputed'`, `'cancelled'`). Metadata captures dispute reasons and late fee amounts. Logs are fire-and-forget (don't block the response).

**Estimated Effort:** Medium (~15K tokens, ~45 min)
**Dependencies:** Prisma migration (applied)

---

### A-06: ~~Favorites / saved items~~ ✅ DONE
**Files:** New `Favorite` Prisma model, `favoriteController.js`, `favoriteRoutes.js`, `FavoriteButton.tsx`, `SavedItems.tsx`, `favorites.ts` API, `Browse.tsx`, `Neighborhood.tsx`, `ItemDetail.tsx`, `Header.tsx`, `App.tsx`, `types/index.ts`
**Why:** Users can't bookmark items for later. Standard for marketplaces.

**Scope:**
- Backend: `Favorite` model with unique user+item constraint, toggle + list endpoints, items annotated with `isFavorited` for logged-in users
- Frontend: `FavoriteButton` component (card overlay + inline variants) with optimistic UI, heart toggle on Browse/Neighborhood/ItemDetail, `/saved` page with protected route, "Saved" nav link in header

**Status:** ✅ DONE — Full-stack favorites system implemented.

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs) — model, migration, 3 endpoints (add/remove/list), frontend heart toggle + saved items page
**Dependencies:** Prisma migration

---

### A-07b: ~~Edit Request feature (full stack)~~ ✅ DONE
**Files:** `requestController.js` (new updateRequest), `requestRoutes.js` (new PUT /:id), `EditRequest.tsx` (new page), `RequestDetail.tsx` (Edit button), `MyRequests.tsx` (Edit button), `index.ts` (export), `App.tsx` (route)
**Why:** Users had no way to edit their requests after posting. If dates, budget, or specs needed adjusting, they had to cancel and recreate.

**Scope:**
- Backend: `PUT /api/requests/:id` — owner-only, open/matched status only, partial field updates, re-runs matching if dates/category changed
- Frontend: `EditRequest.tsx` page following CreateRequest patterns, pre-populated form, Edit buttons on RequestDetail and MyRequests pages
- Route: `/requests/:id/edit`

**Status:** ✅ DONE — Full-stack implementation complete.

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs)
**Dependencies:** None

---

## Medium Value

### A-07: Dispute resolution workflow
**File:** `transactionController.js`
**Why:** When a transaction is disputed, nothing happens. No assignment to admin, no escalation, no resolution flow.

**Minimum:** Notify admin, add dispute notes field, add resolution status.

**Estimated Effort:** Large (~35K tokens, ~2 hrs) — schema changes, admin notification, dispute notes model, resolution endpoint, frontend dispute view
**Dependencies:** Prisma migration. For admin notification: email service (Nodemailer + SMTP provider like SendGrid/Mailgun, or Resend)

---

### A-08: Email verification for new accounts
**File:** `authController.js`
**Why:** Users can register with any email and immediately use the platform. No verification gate.

**Estimated Effort:** Large (~35K tokens, ~2 hrs) — verification token model, send email on register, verify endpoint, frontend verification page
**Dependencies:** Email sending service: `nodemailer` + SMTP credentials (SendGrid free tier, Mailgun, or Resend). `crypto` (Node built-in) for token generation.

---

### A-09: Payment method validation before transaction creation
**File:** `transactionController.js`
**Why:** Transactions are created with no verification that the borrower can pay.

**Estimated Effort:** XL (~80K+ tokens, ~4+ hrs) — full payment integration
**Dependencies:** Payment processor: **Stripe** (`stripe` npm backend, `@stripe/react-stripe-js` + `@stripe/stripe-js` frontend). Requires Stripe account. Alternatively: Square, PayPal.

---

### A-10: ~~"Showing X of Y results" pagination info~~ ✅ DONE
**Files:** `Browse.tsx`, `Neighborhood.tsx`
**Fix:** Added "Showing X–Y of Z results/listings/requests" text above the grid on Browse page and both supply/demand tabs of Neighborhood. Backend already returns total in pagination metadata.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### A-11: ~~Availability calendar on item detail page~~ ✅ DONE
**File:** `ItemDetail.tsx`, new `AvailabilityCalendar.tsx`
**Why:** Booked periods are shown as a text list. A visual calendar would be far more intuitive.

**Fix:** Added `react-day-picker` + `date-fns` based calendar component showing booked dates (red), unavailable dates (gray/strikethrough), and available dates. Respects custom availability rules (recurring days + date ranges) and legacy availableFrom/Until. Shown to all users on item detail page.

**Estimated Effort:** Medium (~20K tokens, ~1 hr) — integrate calendar component, style booked dates
**Dependencies:** `react-day-picker` (~15KB), `date-fns`

---

### A-12: ~~Bulk notification management~~ ✅ DONE
**File:** `notificationController.js`, `notificationRoutes.js`, `Notifications.tsx`, `notifications.ts`
**Why:** Users can only delete notifications one at a time. Need "delete all read" or bulk select.

**Fix:** Added `DELETE /api/notifications/read` endpoint to bulk-delete all read notifications. Added "Clear read" button to Notifications page with toast confirmation.

**Estimated Effort:** Small (~5K tokens, ~15 min) — new endpoint + frontend button
**Dependencies:** None

---

### A-13: ~~Notification archival / auto-cleanup~~ ✅ DONE
**File:** `schedulerService.js`
**Why:** Old notifications are never purged. Table grows indefinitely.

**Fix:** Added `cleanupOldNotifications()` to scheduler — deletes notifications older than 90 days. Runs hourly with other scheduler tasks.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### A-14: ~~Database-level data integrity constraints~~ ✅ DONE
**File:** `prisma/migrations/20260213_add_check_constraints/migration.sql`
**Why:** No CHECK constraints prevent negative fees, pickup after return, or invalid totals.

**Fix:** Added CHECK constraints via raw SQL migration:
- Transactions: return_time > pickup_time, non-negative fees (rental, platform, total, deposit, insurance, late)
- Items: non-negative prices (price_amount, late_fee_amount, replacement_value)
- Ratings: 1-5 range for all rating fields

**Estimated Effort:** Small (~3K tokens, ~10 min) — write raw SQL migration
**Dependencies:** Prisma raw SQL migration

---

### A-15: Optimistic UI updates for mutations
**Files:** All mutation-heavy pages
**Why:** UI doesn't update until API responds, creating perceived lag. React Query supports optimistic updates natively.

**Estimated Effort:** Large (~25K tokens, ~1.5 hrs) — add `onMutate`/`onError`/`onSettled` to ~10 mutations across pages
**Dependencies:** None — React Query has built-in support

---

## Nice to Have

### A-16: Transaction history CSV export
**File:** `Transactions.tsx`
**Why:** Users may need transaction records for tax purposes.

**Estimated Effort:** Medium (~10K tokens, ~30 min) — backend CSV endpoint + frontend download button
**Dependencies:** `csv-stringify` or `papaparse` npm package (~8KB)

---

### A-17: Direct messaging (outside of transactions)
**Files:** New message model/endpoints, `PublicProfile.tsx`, `ItemDetail.tsx`
**Why:** Users can only message each other within a transaction context. Pre-transaction questions require a workaround.

**Estimated Effort:** XL (~60K tokens, ~3 hrs) — new Conversation model, endpoints, frontend chat UI
**Dependencies:** Prisma migration. For real-time: WebSocket (see A-02)

---

### A-18: Search history / recent searches
**File:** `Browse.tsx`
**Why:** No memory of previous searches. Show recent terms below search box.

**Estimated Effort:** Small (~5K tokens, ~15 min) — localStorage-based, frontend only
**Dependencies:** None

---

### A-19: Advanced filter modal
**Files:** `Browse.tsx`, `Neighborhood.tsx`
**Why:** Collapsible filters for multiple categories, rating range, price slider, condition, availability calendar.

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs)
**Dependencies:** `@radix-ui/react-slider` for price range; calendar component (see A-11)

---

### A-20: Infinite scroll / "Load More"
**Files:** `Browse.tsx`, `Neighborhood.tsx`
**Why:** Current pagination is page-based. "Load More" or infinite scroll feels more natural for browsing.

**Estimated Effort:** Medium (~10K tokens, ~30 min)
**Dependencies:** None — React Query has `useInfiniteQuery` built in. Optional: `react-intersection-observer` (~2KB) for scroll detection.

---

### A-21: ~~Rate limiting for matching operations~~ ✅ DONE
**File:** `requestRoutes.js`
**Why:** Match creation is expensive (full DB scan + scoring). No protection against spam.

**Fix:** Added `createRequestLimiter` (10 req/15 min per IP) to POST `/api/requests` route, which triggers the expensive matching logic.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** `express-rate-limit` (already installed)

---

### A-22: Distributed scheduler lock for multi-instance deployments
**File:** `schedulerService.js`
**Why:** If the app runs on multiple servers, scheduled tasks execute multiple times. Redis-based locking would prevent duplicates.

**Estimated Effort:** Medium (~15K tokens, ~45 min)
**Dependencies:** `ioredis` or `redis` npm package + Redis server instance (Redis Cloud free tier, or local Docker)

---

### A-23: Redis caching for insight calculations
**File:** `insightsController.js`
**Why:** Full database scans on every call. 5–15 minute cache would dramatically reduce load.

**Estimated Effort:** Medium (~10K tokens, ~30 min)
**Dependencies:** `ioredis` or `redis` npm package + Redis server instance

---

### A-24: Rating update/delete with grace period
**File:** `ratingController.js`
**Why:** Once submitted, ratings cannot be modified. Users should have a 24-hour window to edit.

**Estimated Effort:** Medium (~10K tokens, ~30 min) — PUT/DELETE endpoints + grace period check + frontend edit UI
**Dependencies:** None

---

### A-25: ~~Auto-complete transactions after timeout~~ ✅ DONE
**File:** `schedulerService.js`
**Why:** If only one party rates, the transaction stays in `return_confirmed` forever. Auto-complete after 7 days.

**Fix:** Added `autoCompleteStaleTransactions()` to scheduler — finds transactions in `return_confirmed` for 7+ days, auto-completes them and notifies both parties.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

---

# 4. UI & Aesthetic Enhancements

## High Impact

### UI-01: ~~Create missing design system components (Avatar, Tabs, Stepper, Dropdown)~~ ✅ FIXED
**Files:** New components in `good-neighbors-web/src/components/ui/`
**Why:** Several UI patterns are reimplemented inline across pages instead of using shared components:
- **Avatar:** Profile photos / initials placeholder used in Header, Matches, Transactions, PublicProfile — all use ad-hoc `<div>` workarounds
- **Tabs:** Supply/Demand toggle (Neighborhood), Lending/Borrowing (Transactions, Dashboard) — reimplemented as button groups each time
- **Stepper:** Transaction status timeline (TransactionDetail) — built inline with no reuse
- **Dropdown/Menu:** Profile dropdown (Header) — custom one-off implementation

**Estimated Effort:** Large (~30K tokens, ~1.5 hrs) — 4 new components + refactor usages across ~8 pages
**Dependencies:** None
**Status:** Fixed — Created Avatar (sm/md/lg with initials fallback), Tabs (underline/pills variants), and Stepper components. Refactored 6 Avatar usages, 2 Tabs usages, and 1 Stepper usage across 8 pages. Dropdown deferred (Header dropdown works fine as-is).

---

### UI-02: ~~Standardize color theming — replace hardcoded colors with theme tokens~~ ✅ FIXED
**Files:** `Dashboard.tsx`, `Neighborhood.tsx`, `Transactions.tsx`, `Matches.tsx`
**Why:** Financial summary cards use hardcoded gradients (`from-green-50 to-emerald-50`, `from-blue-50 to-cyan-50`, `from-purple-50 to-violet-50`) and text colors (`text-green-700`, `text-blue-700`) outside the `primary-*` design system. Supply/Demand toggle uses `bg-green-600` / `bg-blue-600`. Creates inconsistency and makes theme changes painful.

**Fix:** Define semantic color tokens in Tailwind config (e.g., `earned`, `spent`, `savings`) or create a `SummaryCard` component with built-in color variants.

**Estimated Effort:** Medium (~10K tokens, ~30 min)
**Dependencies:** None
**Status:** Fixed — Created SummaryCard component with earned/spent/neutral variants (savings variant removed — feature deleted). Replaced 6 hardcoded gradient cards (3 in Dashboard, 3 in Transactions). Fixed Neighborhood.tsx Supply toggle and type filter buttons from bg-green-500/600 to bg-primary-600.

---

### UI-03: ~~Centralize status color mapping — single source of truth~~ ✅ FIXED
**Files:** `Dashboard.tsx` (lines 27-39), `Transactions.tsx` (lines 14-25), `MyListings.tsx`, `MyRequests.tsx`
**Why:** Transaction/request status → Badge variant mapping is duplicated across pages with inconsistent definitions. `getStatusColor()` appears in multiple files with different logic.

**Fix:** Export `STATUS_VARIANT_MAP` from a shared `constants.ts` or create a `useStatusVariant()` hook.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None
**Status:** Fixed — Created src/utils/statusConfig.ts with all status mappings. Removed duplicated logic from Dashboard (~70 lines), Transactions (~25 lines), MyRequests (~32 lines), and RequestDetail (~22 lines).

---

### UI-04: ~~Add multi-step form progress indicator~~ ✅ FIXED
**Files:** `CreateItem.tsx`, `CreateRequest.tsx`, `Register.tsx`
**Why:** CreateItem has 10 steps, CreateRequest has 6 steps, but users see no progress bar, step counter, or section indicator. Users can't tell how far through the form they are.

**Fix:** Create a `FormStepper` component showing current step / total steps with labeled progress dots or a bar.

**Estimated Effort:** Medium (~10K tokens, ~30 min) — new component + integrate into 3 forms
**Dependencies:** None
**Status:** Fixed — Created FormProgress component (mobile: "Step X of Y" + progress bar; desktop: dots with connecting lines + labels). Integrated into CreateItem (3-5 dynamic steps based on service vs item) and CreateRequest (5 steps).

---

### UI-05: ~~Fix mobile responsiveness gaps~~ ✅ FIXED
**Files:** `Dashboard.tsx`, `Neighborhood.tsx`, `Matches.tsx`, `Transactions.tsx`
**Why:** Several grids lack proper mobile breakpoints:
- Dashboard financial summary: `grid-cols-3` only — no stacking on mobile
- Dashboard quick actions: `grid-cols-2` doesn't stack on very small screens
- Transactions detail grid: `grid-cols-2 sm:grid-cols-4` — needs `col-span` adjustments on mobile
- Match card action buttons don't stack properly on small screens

**Fix:** Add `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` patterns and test at 375px (iPhone SE) and 768px (iPad).

**Estimated Effort:** Medium (~10K tokens, ~30 min) — audit + fix ~6 pages
**Dependencies:** None
**Status:** Fixed — 17 grid-cols fixes across 8 files (Dashboard, CreateItem, CreateRequest, Register, EditItem, Profile, ItemDetail, Transactions). All 2-column and 3-column grids now stack to single column on mobile.

---

## Medium Impact

### UI-06: Consistent image/photo handling with placeholder component
**Files:** `Neighborhood.tsx`, `Matches.tsx`, `Transactions.tsx`, `MyListings.tsx`, `ItemDetail.tsx`
**Why:** Item photos are handled inconsistently — some use `aspect-video`, others use fixed `w-16 h-16`. Missing photos show different placeholder styles per page (gray boxes, colored gradients, icon-only). No loading state for images.

**Fix:** Create a `ResponsiveImage` component with consistent aspect ratio, loading skeleton, error fallback, and themed placeholder.

**Estimated Effort:** Medium (~10K tokens, ~30 min) — new component + update ~6 pages
**Dependencies:** None

---

### UI-07: ~~Add transitions and micro-animations~~ ✅ DONE
**Files:** `index.css`, `Modal.tsx`, `Card.tsx`, `Neighborhood.tsx`, `Browse.tsx`
**Fix:** Added CSS keyframe animations: `fadeIn` (modal backdrop), `slideUp` (modal content), `cardFadeIn` (staggered card entrance on grids), `fadeInUp` (page transitions). Applied `modal-backdrop`/`modal-content` classes to Modal, `card-fade-in` with staggered delays to Neighborhood and Browse item grids. Added `style` prop to Card component for animation delays.

**Estimated Effort:** Medium (~10K tokens, ~30 min)
**Dependencies:** None

---

### UI-08: Typography hierarchy — consistent heading components
**Files:** All pages
**Why:** Title sizes vary inconsistently: `text-2xl font-bold` on Dashboard, different styling on Neighborhood, `text-xl` / `text-lg` mixed on detail pages. No semantic h1/h2/h3 component usage.

**Fix:** Create `PageTitle`, `SectionTitle`, `CardTitle` components (or heading variants) and apply consistently across all pages.

**Estimated Effort:** Medium (~15K tokens, ~45 min) — new components + update ~15 pages
**Dependencies:** None

---

### UI-09: ~~Ensure all clickable cards have consistent hover feedback~~ ✅ DONE
**Files:** `Dashboard.tsx`, `Neighborhood.tsx`, `Transactions.tsx`, `MyListings.tsx`, `MyRequests.tsx`
**Why:** The `Card` component supports a `hover` prop for shadow animation, but many Link-wrapped cards don't pass `hover={true}`. Financial summary cards, transaction cards, and listing cards wrapped in `<Link>` are clickable but don't show hover state.

**Fix:** Audit all `<Link><Card>` combinations and add `hover` prop. Consider auto-detecting parent `<Link>` in Card component.
**Status:** ✅ DONE — Added hover prop to Card in Matches. MyListings hover prop later removed (card itself is not a link; status badges are now individually clickable with their own hover effects).

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

### UI-10: ~~Replace inline button styling with Button component~~ ✅ DONE
**Files:** `Matches.tsx`, `Neighborhood.tsx`, `NotificationBell.tsx`
**Fix:** Replaced inline-styled `<button>` elements with `<Button>` component: "View details" toggle in Matches (ghost variant), type filter toggles in Neighborhood (primary/secondary variants), "Clear all" chip action (ghost), "Mark all as read" in NotificationBell (ghost). Consistent focus rings, sizing, and hover states across all.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

### UI-11: ~~Improve empty state theming with contextual variants~~ ✅ DONE (already implemented)
**Files:** `EmptyState.tsx`
**Why:** All empty states look identical — same gray icon, same layout. No contextual variation for "no items" vs "no matches" vs "no transactions". Icon color is hardcoded `text-gray-400`.

**Fix:** Already had `variant` prop with `default`, `info`, `success`, `warning` styles including background colors, icon colors, and text colors.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None

---

## Low Impact

### UI-12: ~~Improve star rating display~~ ✅ DONE
**Files:** `Matches.tsx` (line 185), `PublicProfile.tsx`, `MyRatings.tsx`
**Why:** Ratings use `'★'.repeat(n) + '☆'.repeat(5-n)` character strings — looks crude, no partial stars, no animation. (Note: accessibility tracked in I-24.)

**Fix:** Create a `StarRating` component with filled/empty/half star SVGs and optional hover interaction.
**Status:** ✅ DONE — Created StarRating.tsx, replaced inline star rendering in 6 pages (Matches, Dashboard, PublicProfile, MyRatings, Profile).

**Estimated Effort:** Small (~5K tokens, ~15 min) — new component + update ~4 pages
**Dependencies:** None

---

### UI-13: Add dark mode support
**Files:** `tailwind.config.js`, `index.css`, all pages
**Why:** No dark mode option. With Tailwind's `dark:` variant, foundational support is straightforward, but full coverage requires updating all hardcoded background/text colors.

**Fix:** Add `darkMode: 'class'` to Tailwind config, define dark palette, add toggle in Header. Phase: foundation first (config + key layouts), then page-by-page rollout.

**Estimated Effort:** XL (~60K tokens, ~3 hrs) — config + update all ~20 pages + all components
**Dependencies:** None

---

### UI-14: ~~Add focus ring contrast and keyboard navigation polish~~ ✅ FIXED
**Files:** `index.css`, `Button.tsx`, form input components
**Why:** Focus rings use `focus:ring-primary-500` which may lack contrast on white backgrounds. Not all interactive elements show clear focus state for keyboard users.

**Fix:** Test and adjust focus ring colors for WCAG AA contrast. Ensure all buttons, links, cards, and form elements have visible focus indicators.

**Estimated Effort:** Small (~5K tokens, ~15 min)
**Dependencies:** None
**Status:** Fixed — added base-layer CSS: `:focus:not(:focus-visible)` removes outlines on mouse clicks, `:focus-visible` shows primary ring on keyboard navigation. Updated Button component and all `.btn`/`.input` CSS classes from `focus:` to `focus-visible:`. Focus rings now only appear during keyboard Tab navigation (WCAG AA compliant).

---

### UI-15: ~~Contextual demand card styling on Neighborhood page~~ ✅ DONE
**File:** `Neighborhood.tsx`
**Fix:** Added category-to-color mapping (8 categories: Outdoor=green, Tools=amber, Electronics=violet, Home=teal, Sports=red, Party=pink, Vehicles=slate, Music=indigo). Each demand card's placeholder gradient and icon color now matches its category tier1, with blue as default fallback.

**Estimated Effort:** Small (~3K tokens, ~10 min)
**Dependencies:** None

---

---

# 5. Moonshot Additions (Ambitious Feature Roadmap)

These are high-ambition features that would take Good Neighbors from a working prototype to a production-ready, market-competitive platform.

## Infrastructure & Platform

### M-01: Photo Upload with Cloud Storage — ✅ PARTIALLY DONE (local storage implemented)
**Files:** New upload endpoint, S3/Cloudinary integration, CreateItem/EditItem/Profile photo UIs
**Why:** Users currently paste URLs manually. Real photo upload is table stakes for a marketplace.

**Done:**
- Backend: `POST /api/uploads` with multer → local disk storage in `uploads/` dir
- Frontend: PhotoUpload component with drag-and-drop, preview thumbnails, remove button
- Integrated into CreateItem and EditItem (goods/spaces only, not services)
- File validation: images only (JPEG/PNG/GIF/WEBP), 5MB limit, max 6 files

**Remaining:**
- Cloud storage migration (S3/Cloudinary) for production
- Profile photos, verification photos
- Image optimization: auto-resize, WebP conversion, thumbnail generation
- Photo reorder/drag-to-sort within upload component

**Estimated Remaining Effort:** Large (~40K tokens, ~2 hrs)
**Dependencies:** `@aws-sdk/client-s3` or `cloudinary` npm packages for cloud migration.

---

### M-02: Stripe Connect Payment Processing
**Files:** New payment service, transactionController, frontend checkout flow
**Why:** Fee math exists but no actual money moves. Stripe Connect enables marketplace payments with split payouts.

**Scope:**
- Backend: Stripe Connect onboarding for lenders (connected accounts), PaymentIntent creation on transaction, automatic split (lender payout - platform fee), webhook handlers for payment events
- Frontend: Stripe Elements for card input, payout dashboard for lenders, payment history
- Handle deposits (auth + capture), refunds on cancellation, dispute chargebacks
- Tax reporting: automatic 1099-K generation via Stripe

**Estimated Effort:** XXL (~150K+ tokens, ~8+ hrs)
**Dependencies:** `stripe` (backend), `@stripe/react-stripe-js` + `@stripe/stripe-js` (frontend). Stripe account with Connect enabled.

---

### M-03: Real-time WebSocket Layer
**Files:** New WebSocket server, frontend socket context, message/notification integration
**Why:** 30-second polling is wasteful and feels sluggish. Real-time messaging and instant notifications are expected in 2026.

**Scope:**
- Backend: Socket.IO server integrated with Express, JWT auth on connection, rooms per transaction (for messages) + per user (for notifications)
- Frontend: SocketContext provider, auto-reconnect, optimistic message sending, live typing indicators
- Live notification delivery (replace polling), unread count via socket events
- Presence indicators ("Online" / "Last seen 5 min ago") on profiles

**Estimated Effort:** XL (~80K tokens, ~4 hrs)
**Dependencies:** `socket.io` (backend), `socket.io-client` (frontend)

---

### M-04: Progressive Web App (PWA) with Offline Support
**Files:** Service worker, manifest.json, caching strategy, offline UI
**Why:** Native app feel without app store distribution. Push notifications, offline browsing, add-to-homescreen.

**Scope:**
- Service worker with Workbox: cache-first for static assets, network-first for API
- Offline mode: browse cached items/requests, queue mutations for sync
- Web Push notifications via Firebase Cloud Messaging or native Web Push API
- App manifest with icons, splash screen, standalone display mode

**Estimated Effort:** Large (~40K tokens, ~2 hrs)
**Dependencies:** `workbox-webpack-plugin` or Vite PWA plugin (`vite-plugin-pwa`), optional `firebase` for push notifications

---

### M-05: Docker + CI/CD Pipeline
**Files:** Dockerfiles, docker-compose.yml, GitHub Actions workflows
**Why:** No deployment infrastructure exists. Need containerized builds, automated testing, and deployment pipeline.

**Scope:**
- Multi-stage Dockerfiles (backend + frontend)
- docker-compose for local dev (app + PostgreSQL + Redis)
- GitHub Actions: lint, type-check, test, build, deploy
- Environment management (dev/staging/production)
- Database migration automation in CI

**Estimated Effort:** Large (~35K tokens, ~2 hrs)
**Dependencies:** Docker, GitHub Actions (free tier)

---

### M-06: Comprehensive Test Suite
**Files:** New test directories, test utilities, CI integration
**Why:** Zero tests currently exist. Every feature addition risks regressions.

**Scope:**
- Backend: Jest + Supertest for API integration tests, unit tests for matching algorithm, fee calculation, dateConflict logic
- Frontend: Vitest + React Testing Library for component tests, MSW for API mocking
- E2E: Playwright for critical user flows (register → list item → create request → match → accept → complete transaction → rate)
- Coverage targets: 80%+ for utils, 60%+ for controllers, critical path E2E

**Estimated Effort:** XXL (~120K tokens, ~6 hrs)
**Dependencies:** `jest`, `supertest`, `vitest`, `@testing-library/react`, `msw`, `playwright`

---

## User Experience & Engagement

### M-07: Interactive Map View for Browsing
**Files:** New MapView component, Neighborhood page integration, item/request pins
**Why:** A map view is the most natural way to browse neighborhood items by location. Text-only distance labels are abstract.

**Scope:**
- Mapbox GL JS or Leaflet map component
- Item pins with category-colored markers, price labels, clickable popups
- Cluster markers for dense areas
- Toggle between map and list view on Neighborhood page
- Request pins on Demand tab showing search radius circles
- GPS-centered on user's location with drag-to-search

**Estimated Effort:** XL (~60K tokens, ~3 hrs)
**Dependencies:** `mapbox-gl` + `react-map-gl` or `leaflet` + `react-leaflet`. Mapbox requires API key (free tier: 50K loads/month).

---

### M-08: AI-Powered Item Description & Photo Analysis
**Files:** New AI service, CreateItem integration, moderation pipeline
**Why:** Help users write better listings and auto-detect item condition from photos.

**Scope:**
- Photo → description: Upload item photo, Claude/GPT generates title, description, suggested category, estimated condition
- Smart specs: auto-fill spec fields from photo (e.g., detect "DeWalt" brand, "20V" voltage from drill photo)
- Content moderation: flag inappropriate photos/text before listing goes live
- Price suggestion enhancement: factor in item brand, model, age detected from photos

**Estimated Effort:** XL (~70K tokens, ~4 hrs)
**Dependencies:** Anthropic API (`@anthropic-ai/sdk`) or OpenAI API. Image processing: `sharp` for pre-processing.

---

### M-09: Calendar Sync & Availability Calendar
**Files:** ItemDetail calendar component, iCal export endpoint, Google Calendar integration
**Why:** Lenders need to see bookings visually. Borrowers need to pick available dates easily. Lenders want bookings in their personal calendar.

**Scope:**
- Interactive availability calendar on ItemDetail (visual month view showing available/booked/unavailable dates)
- Date picker for booking that grays out unavailable dates (combines availability rules + booked periods)
- iCal (.ics) export endpoint for each item's bookings
- Google Calendar integration: auto-create events on booking confirmation
- Two-way sync: block dates from external calendar

**Estimated Effort:** XL (~60K tokens, ~3 hrs)
**Dependencies:** `react-day-picker` or `@fullcalendar/react` (frontend), `ical-generator` (backend), Google Calendar API for two-way sync

---

### M-10: Reputation Tiers & Gamification
**Files:** New tier calculation service, profile badges, Dashboard achievements
**Why:** Drive engagement and build trust through visible reputation milestones.

**Scope:**
- Tier system: New Neighbor → Bronze (5+ transactions) → Silver (15+ transactions, 4.0+ rating) → Gold (30+ transactions, 4.5+ rating) → Trusted Neighbor (50+ transactions, 4.7+ rating, verified)
- Visual badges on profiles and listings
- Tier-based perks: higher listing visibility, lower platform fees, priority matching, extended request expiration
- Achievement system: "First Lend", "Helped 10 Neighbors", "5-Star Streak", "Category Expert"
- Leaderboard: top lenders/borrowers in each neighborhood (opt-in)

**Estimated Effort:** Large (~40K tokens, ~2 hrs)
**Dependencies:** None (pure application logic)

---

### M-11: Direct Messaging & Conversations (Pre-Transaction)
**Files:** New Conversation model, messaging endpoints, ChatPage, ItemDetail "Ask a Question" button
**Why:** Users can only message within transactions. Pre-transaction questions ("Is this drill corded or cordless?", "Can I see more photos?") require committing to a borrow first.

**Scope:**
- New Conversation model (user-to-user, optionally linked to item)
- "Ask About This Item" button on ItemDetail → opens conversation with owner
- Inbox page: all conversations grouped by contact, unread badges
- Real-time via WebSocket (piggyback on M-03)
- Spam protection: rate limiting, block user, report

**Estimated Effort:** XL (~60K tokens, ~3 hrs)
**Dependencies:** Prisma migration. Benefits from M-03 (WebSocket) for real-time.

---

### M-12: Advanced Search with Filters & Saved Searches
**Files:** New search UI, backend search improvements, SavedSearch model
**Why:** Current search is basic text matching. Power users need advanced filtering and the ability to save searches for notifications.

**Scope:**
- Advanced filter panel: price range slider, condition checkboxes, distance radius slider, date availability picker, rating minimum
- Full-text search with PostgreSQL `tsvector` / `tsquery` (better than LIKE/keyword overlap)
- Saved searches: persist filter combinations, get notified when new items match
- Recent searches (localStorage) with quick re-apply
- Search suggestions / autocomplete from category hierarchy

**Estimated Effort:** Large (~40K tokens, ~2 hrs)
**Dependencies:** PostgreSQL full-text search (built-in). Optional: `@radix-ui/react-slider` for UI.

---

### M-13: Item Bundles & Package Deals
**Files:** New Bundle model, CreateBundle page, pricing logic, Neighborhood display
**Why:** Lenders often have related items (e.g., camping set: tent + sleeping bag + lantern). Bundles incentivize multi-item borrows at a discount.

**Scope:**
- Bundle model: owner, title, items (relation), bundle discount percentage
- CreateBundle page: select from own items, set discount, preview total pricing
- Neighborhood page: bundle cards with item previews and "Save X%" badge
- Booking: single transaction for entire bundle, combined fee calculation
- Bundle availability: intersection of all item availability windows

**Estimated Effort:** XL (~60K tokens, ~3 hrs)
**Dependencies:** Prisma migration

---

### M-14: Delivery & Pickup Coordination
**Files:** New delivery options on items, scheduling UI, route optimization
**Why:** Not everyone can drive to pick up items. Delivery options expand the effective marketplace radius.

**Scope:**
- Item listing: add delivery options (pickup only / will deliver within X miles / both)
- Delivery fee calculation based on distance
- Scheduling: borrower proposes pickup/delivery time slots, lender confirms
- In-app directions integration (Google Maps deep link)
- Optional: community volunteer delivery network

**Estimated Effort:** Large (~40K tokens, ~2 hrs)
**Dependencies:** Google Maps Directions API for distance/time estimates (optional)

---

### M-15: Admin Dashboard
**Files:** New admin routes, AdminDashboard page, moderation tools
**Why:** No way to manage users, resolve disputes, view platform analytics, or moderate content.

**Scope:**
- Admin role on User model with admin middleware guard
- Dashboard: platform stats (users, items, transactions, revenue), growth charts
- User management: view/edit/suspend accounts, verify users
- Dispute resolution: view evidence, communicate with parties, resolve with refund/penalty
- Content moderation: flagged items/messages queue, approve/reject
- Transaction oversight: view any transaction, force status changes
- Financial reports: platform fee revenue, payout tracking

**Estimated Effort:** XXL (~100K tokens, ~5 hrs)
**Dependencies:** Chart library (`recharts` or `chart.js`), Prisma migration for admin role

---

### M-16: Email & SMS Notification Delivery
**Files:** notificationService.js, email templates, SMS integration
**Why:** Notification stubs exist for email/SMS but nothing is implemented. Critical for user engagement outside the app.

**Scope:**
- Email: transactional email service (match found, transaction updates, return reminders)
- HTML email templates with branding (React Email or MJML)
- SMS: critical alerts only (pickup confirmation, overdue warning)
- Digest mode: daily summary email instead of per-event
- Unsubscribe links with per-type granularity (already have preference model)

**Estimated Effort:** Large (~35K tokens, ~2 hrs)
**Dependencies:** Email: `nodemailer` + SendGrid/Resend/AWS SES. SMS: Twilio (`twilio` npm). React Email: `@react-email/components`.

---

### M-17: Sustainability & Community Impact Tracking
**Files:** New impact calculation service, Dashboard widget, profile badges
**Why:** Differentiate from generic rental platforms. Show the environmental and community impact of sharing.

**Scope:**
- Carbon footprint savings: estimate CO2 saved per transaction based on item category (vs. buying new + shipping)
- Community impact dashboard: "Your neighborhood has shared X items, saved $Y, avoided Z lbs of waste"
- Personal impact card on profile: items shared, money saved, CO2 avoided
- Monthly/yearly impact reports
- "Green Neighbor" badge for high-impact users
- Leaderboard: most sustainable neighborhoods

**Estimated Effort:** Medium (~20K tokens, ~1 hr)
**Dependencies:** None (impact formulas are estimation-based)

---

### M-18: Recurring Rentals & Subscriptions
**Files:** RecurringBooking model, scheduler integration, auto-renewal logic
**Why:** Some sharing is recurring (weekly lawn mower, monthly parking space, regular dog walking service). One-off transactions are friction-heavy for repeat use.

**Scope:**
- Recurring booking setup: frequency (weekly/biweekly/monthly), auto-renew toggle
- Automatic transaction creation via scheduler
- Subscription pricing: discount for recurring vs. one-off
- Easy cancellation with notice period
- Calendar integration showing recurring slots

**Estimated Effort:** XL (~60K tokens, ~3 hrs)
**Dependencies:** Prisma migration. Benefits from M-02 (Stripe) for automatic billing.

---

### M-19: Multi-Neighborhood & Cross-Neighborhood Discovery
**Files:** Neighborhood model, geographic clustering, expanded search
**Why:** Currently all users are in one flat pool. Real neighborhoods have distinct identities and trust circles.

**Scope:**
- Neighborhood model: name, boundaries (polygon or zipcode set), admin users
- Neighborhood landing pages: local stats, top items, recent activity
- Cross-neighborhood search: browse adjacent neighborhoods, distance-based expansion
- Neighborhood trust levels: prefer intra-neighborhood matches, require extra verification for cross-neighborhood
- Neighborhood invite system: existing members vouch for new joiners

**Estimated Effort:** XL (~70K tokens, ~4 hrs)
**Dependencies:** Prisma migration. Optional: PostGIS for geographic boundaries.

---

### M-20: QR Code Verification for Handoffs
**Files:** QR generation service, scanner component, transaction flow integration
**Why:** Current pickup/return confirmation is honor-based button clicks. QR codes add physical verification.

**Scope:**
- Generate unique QR code per transaction (encode transaction ID + verification hash)
- Pickup: lender shows QR, borrower scans to confirm handoff → auto-confirms pickup
- Return: borrower shows QR, lender scans to confirm return → triggers return flow
- Fallback: manual confirmation still available if phone camera unavailable
- Optional: geo-fence verification (confirm both parties are within 100m)

**Estimated Effort:** Medium (~20K tokens, ~1 hr)
**Dependencies:** `qrcode` (backend generation), `html5-qrcode` or `@zxing/library` (frontend scanning)

---

### M-21: Waitlist & Availability Alerts
**Files:** Waitlist model, notification integration, ItemDetail "Notify Me" button
**Why:** Popular items are often booked. Users should be able to join a waitlist and get notified when the item becomes available.

**Scope:**
- "Notify When Available" button on booked items
- Waitlist queue per item with priority (first-come-first-served or reputation-based)
- Auto-notify when booking ends or dates open up
- Auto-match waitlisted users to newly available slots
- Waitlist position indicator ("You're #3 in line")

**Estimated Effort:** Medium (~20K tokens, ~1 hr)
**Dependencies:** Prisma migration

---

### M-22: Referral Program
**Files:** Referral model, invite flow, reward tracking
**Why:** Word-of-mouth is the natural growth channel for neighborhood platforms. Incentivize users to invite their actual neighbors.

**Scope:**
- Unique referral codes per user
- Share via link, SMS, or email with personalized message
- Reward structure: both referrer and new user get credit (e.g., $5 platform fee waiver)
- Dashboard: referral stats, pending rewards, invite history
- Neighborhood-level referral contests ("Help your neighborhood reach 100 members")

**Estimated Effort:** Large (~35K tokens, ~2 hrs)
**Dependencies:** Prisma migration. Benefits from M-02 (Stripe) for credit application.

---

### M-23: Community Events & Bulletin Board
**Files:** Event model, EventsPage, Neighborhood integration
**Why:** Sharing isn't just about items. Neighborhood tool-share days, skill-share workshops, and community events build the social fabric that makes the platform work.

**Scope:**
- Event model: title, description, date/time, location, organizer, RSVP list, category (tool-share day, workshop, meetup, garage sale)
- Events page: upcoming events, past events, create event
- RSVP with headcount
- Integration with items: "Bring your listed items to share at this event"
- Neighborhood bulletin board: announcements, lost & found, recommendations

**Estimated Effort:** XL (~60K tokens, ~3 hrs)
**Dependencies:** Prisma migration

---

### M-24: Internationalization (i18n) & Multi-Language Support
**Files:** All frontend pages, translation files, language selector
**Why:** Expand beyond English-speaking neighborhoods. Many US neighborhoods have significant non-English-speaking populations.

**Scope:**
- i18n framework integration (react-intl or react-i18next)
- Extract all user-facing strings to translation files
- Language selector in header/profile
- Initial languages: English, Spanish (highest US demand)
- RTL support foundation for future Arabic/Hebrew
- Backend: locale-aware error messages

**Estimated Effort:** XXL (~100K tokens, ~5 hrs)
**Dependencies:** `react-i18next` + `i18next` or `react-intl`. Translation files per language.

---

---

# Summary

| Category | Critical/High | Medium | Low/Nice-to-Have | Total | Fixed |
|----------|--------------|--------|-----------------|-------|-------|
| **Bugs** | 22 | 24 | 13 | **69** | 67 |
| **Improvements** | 12 | 16 | 12 | **43** | 32 |
| **Additions** | 7 | 9 | 10 | **26** | 3 |
| **UI & Aesthetic** | 5 | 6 | 4 | **15** | 10 |
| **Moonshot Additions** | — | — | — | **24** | 0 |
| **Total** | **46** | **55** | **39** | **177** | **112** |

## Effort Totals by Phase

| Phase | Items | Est. Tokens | Est. Time | External Dependencies |
|-------|-------|------------|-----------|----------------------|
| **Phase 1** (Critical bugs) | B-01 → B-09 | ~30K | ~1.5 hrs | Prisma migration (B-06) |
| **Phase 2** (High bugs + improvements) | B-10 → B-20, I-01 → I-08 | ~170K | ~8 hrs | `express-rate-limit`, `express-validator` or `zod`, Prisma migrations |
| **Phase 3** (Medium bugs + high-value adds) | B-21 → B-48, A-01 → A-06 | ~230K | ~12 hrs | `socket.io` or `ws` (WebSocket), `react-hot-toast`, `react-day-picker`, Prisma migrations |
| **Phase 3.5** (UI polish) | UI-01 → UI-15 | ~180K | ~9 hrs | Optional: `framer-motion` for page transitions |
| **Phase 4** (New findings + polish) | B-49 → B-69, I-29 → I-36 | ~200K | ~10 hrs | `@sentry/react` (optional), email service (optional) |
| **Phase 5** (Remaining adds + nice-to-haves) | A-01 → A-25, I-09 → I-28 | ~250K | ~14 hrs | `redis`/`ioredis`, `stripe`, `nodemailer`, `papaparse`, `react-intersection-observer` |
| **Phase 6** (Moonshot / production) | M-01 → M-24 | ~1,400K | ~70 hrs | `multer`, `@aws-sdk/client-s3`, `stripe`, `socket.io`, `mapbox-gl`, `@anthropic-ai/sdk`, `playwright`, `react-i18next`, `twilio`, and more |
| **Grand Total** | 170 items | **~2,460K** | **~125 hrs** | See above |

### Recommended Priority Order

**Phase 1 — Fix before any real users (Critical bugs):** ✅ COMPLETE
B-01 through B-09. These are data corruption, security, and correctness issues.
All 9 critical bugs fixed.

**Phase 2 — High-priority bugs and improvements (next sprint):** ✅ COMPLETE
B-10 through B-20, I-01 through I-08. Input validation, race conditions, error handling, auth hardening.
All 11 high-priority bugs and 8 improvements fixed/implemented.

**Phase 3 — Medium bugs + high-value additions (following sprint):** ✅ COMPLETE
B-21 through B-50, A-03. Medium bugs resolved, toast system, confirm dialogs, borrow flow, MyRequests reorg.

**Phase 3.5 — UI polish (can interleave with Phase 3):** 🔄 IN PROGRESS (8/15)
UI-01 through UI-05 complete. UI-09, UI-11, UI-12 complete. UI-06 through UI-08, UI-10, UI-13 through UI-15 remaining.

**Phase 4 — Seamless Experience Polish (recommended next):** 🎯 RECOMMENDED
Focus: Make the app feel professional and seamless. Key items:
- B-51 (spec scoring div-by-zero) — **quick win, prevents crash**
- B-52 (request auth bypass) — **security fix**
- B-54 (date conflict feedback in borrow modal) — **high UX impact**
- B-55 (match accept navigation) — **high UX impact**
- B-60 (ARIA accessibility) — **compliance**
- B-61 (top-level ErrorBoundary) — **quick win, prevents white screen**
- B-62 (Action Center overflow) — **dashboard polish**
- B-63 (Rate button on history) — **engagement**
- B-66 (404 page) — **quick win**
- I-29 (loading skeletons) — **biggest perceived performance improvement**
- I-32 (real-time date conflict) — **critical UX improvement**
- I-34 (code splitting) — **performance**
- I-35 (filter breadcrumbs) — **usability**

**Phase 5 — High-value additions (ongoing):**
A-01 (token refresh), A-02 (real-time), A-04 (sorting/filtering), A-05 (audit log), A-06 (favorites), remaining improvements.

**Phase 6 — Moonshot / Production-Ready (when ready to launch):**
M-01 through M-24. Photo uploads, payments, WebSockets, PWA, Docker/CI, tests, map view, AI descriptions, admin dashboard, i18n. Estimated ~1,400K tokens, ~70+ hrs total.
