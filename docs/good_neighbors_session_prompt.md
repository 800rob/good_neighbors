# Good Neighbors — Session Startup Prompt

Copy everything below the line and paste it as your first message in a new Claude Code session.

---

## Project: Good Neighbors

A neighbor-to-neighbor sharing/rental platform (items, services, spaces). Two separate repos, one backend API and one React frontend.

### Repos & Paths

| | Path | GitHub |
|---|---|---|
| **Backend** | `C:/Users/robbi/shareit-backend` | https://github.com/800rob/good_neighbors |
| **Frontend** | `C:/Users/robbi/good-neighbors-web` | https://github.com/800rob/good-neighbors-web |

### Tech Stack

- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL, JWT auth
- **Frontend:** React 18, TypeScript, Vite, TanStack React Query, React Router, React Hook Form + Zod, Tailwind CSS

### Running the App

- Backend (must start first): `cd "C:/Users/robbi/shareit-backend" && npm run dev` → port 3000
- Frontend: `cd "C:/Users/robbi/good-neighbors-web" && npm run dev` → port 5173 (Vite proxies `/api` to localhost:3000)

### Key Reference Files

| File | Path | Purpose |
|---|---|---|
| **Working Log** | `C:/Users/robbi/Rob/AI/Good Neighbors/good_neighbors_working_log.md` | Chronological log of all sessions — read tail (~80 lines) to see latest |
| **App Outline** | `C:/Users/robbi/Rob/AI/Good Neighbors/Good_Neighbors_App_Outline.txt` | Complete feature-level outline of the current app |
| **Build Prompt** | `C:/Users/robbi/Rob/AI/Good Neighbors/Good_Neighbors_Build_Prompt.txt` | Reverse-engineered prompt to rebuild the app from scratch |
| **Bugs/Improvements** | `C:/Users/robbi/Rob/AI/Good Neighbors/claude_GN_bugs_improvs_adds.md` | Tracked bugs, improvements, and additions with status |
| **This Prompt** | `C:/Users/robbi/Rob/AI/Good Neighbors/good_neighbors_session_prompt.md` | What you're reading now |

### Key Backend Structure
```
shareit-backend/src/
  config/database.js              # Prisma client singleton
  controllers/                    # Route handlers
    authController.js             # Register, login, logout, changePassword
    itemController.js             # CRUD items + reverse matching on create
    requestController.js          # CRUD requests + browse
    matchController.js            # Incoming matches, accept/decline (auto-creates transaction on accept)
    transactionController.js      # 9-state lifecycle
    messageController.js          # Per-transaction chat
    ratingController.js           # Dual ratings with visibility rules
    notificationController.js     # 18 notification types
    insightsController.js         # Nearby demand/supply
    categoryController.js         # Hierarchical category API
  routes/                         # Express route definitions (1:1 with controllers)
  middleware/authMiddleware.js     # JWT verification + optional auth
  middleware/validation.js        # express-validator error handling
  middleware/errorHandler.js      # asyncHandler + global error handler
  utils/
    matching.js                   # Match scoring (0-100) + bidirectional matching
    feeCalculation.js             # Shared fee calc with cheapest-tier auto-selection + tax
    dateConflict.js               # Blackout date overlap detection + booked periods
    taxRates.js                   # US state sales tax rate lookup (50 states + DC)
    specUtils.js                  # Category spec definitions + validation
    distance.js                   # Haversine distance calculation
  services/
    notificationService.js        # notifyUser() — 19 types, in-app + email/SMS stubs
    schedulerService.js            # Hourly automated tasks
prisma/schema.prisma              # Database schema (11 models)
prisma/seed.js                    # 12 users, 16 items, 3 requests, 1 transaction
```

### Key Frontend Structure
```
good-neighbors-web/src/
  api/                            # Axios API layer
    client.ts                     # Axios instance with interceptors, ApiError class, logout flag
    items.ts, requests.ts, transactions.ts, notifications.ts, categories.ts
  components/
    layout/Layout.tsx             # Header (with Action Center nav link), footer, nav, PageContainer
    ui/                           # Button, Card, Modal, Badge, Alert, Input, etc.
    ActionCard.tsx                # ActionCard, MatchActionCard, TieredAction type, tierStyles (shared)
    ActionCenterSummary.tsx       # Compact dashboard widget with urgency summaries
    CategorySelector.tsx          # 3-tier hierarchical picker + fuzzy search
    SpecsForm.tsx                 # Dynamic specs (lender/borrower modes)
    SpecsDisplay.tsx              # Read-only spec badges
    PricingSuggestions.tsx         # Price range suggestions
    notifications/                # NotificationBell, NotificationItem
  hooks/
    useActionCenter.ts            # Shared hook: queries, mutations, urgency classification, grouped actions
    useDraftForm.ts               # Draft save tracking for forms
  contexts/
    AuthContext.tsx                # User + JWT state, Zod validation on stored user
    NotificationContext.tsx        # Polling + unread tracking
  pages/                          # 23 route pages
    Dashboard.tsx, ActionCenter.tsx, Neighborhood.tsx, ItemDetail.tsx,
    CreateItem.tsx, Matches.tsx, RequestDetail.tsx, CreateRequest.tsx,
    EditRequest.tsx, Transactions.tsx, TransactionDetail.tsx, Profile.tsx,
    PublicProfile.tsx, MyRatings.tsx, etc.
  utils/
    feeEstimate.ts                # Client-side fee calculation (mirrors backend: cheapest-tier, 50/50 platform fee, state tax)
    statusConfig.ts               # Transaction urgency tiers, quick actions, status labels
    dateFormat.ts                  # UTC date formatting for date-only fields
    dateHelpers.ts                # fmtShort, formatDateContext (used by ActionCard/MatchActionCard)
  types/index.ts                  # All TypeScript interfaces + enums
  App.tsx                         # Route definitions + React.lazy code splitting (23 pages)
```

### Session Instructions

1. **Read the tail of the working log first** to understand recent changes and current state.
2. **Use forward slashes** in all bash paths (`C:/Users/robbi/...`) — backslashes fail in the shell.
3. **After completing work, append a log entry** to the working log:
   - `## Session: Brief Summary (Date)`
   - List each change with files modified and what was done
   - Keep it concise but specific enough to reconstruct what happened
4. **Don't commit unless I ask.** Changes stay uncommitted until I say otherwise.
5. **Plan before implementing** — use plan mode for non-trivial changes so I can approve the approach.

### End-of-Session Checklist

Before wrapping up a session (or after completing a significant chunk of work), update these three documentation files:

1. **Working Log** (`good_neighbors_working_log.md`):
   - Append a dated session entry describing all changes made, files touched, and commits pushed

2. **App Outline** (`Good_Neighbors_App_Outline.txt`):
   - Refresh to reflect the full current state of the app
   - Update any features added/changed, new endpoints, new pages, model changes
   - Update the "Git Status" section at the bottom
   - This is a living document — treat it as "what does the app do RIGHT NOW"

3. **Build Prompt** (`Good_Neighbors_Build_Prompt.txt`):
   - Refresh to match the current app — if someone pasted this prompt, it should produce the app as it exists today
   - Update matching algorithm details, frontend page descriptions, API endpoints, component behavior
   - This is a theoretical rebuild prompt — keep it comprehensive but prompt-shaped (imperative instructions)

4. **Bugs/Improvements** (`claude_GN_bugs_improvs_adds.md`):
   - If you fixed any tracked bugs or completed any improvements, mark them with status updates
   - If you discovered new bugs or improvement opportunities, add them to the appropriate section

All four files live in: `C:/Users/robbi/Rob/AI/Good Neighbors/`

### What I need done today:

[Describe your task here]
