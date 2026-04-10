# Rentify

> A full-stack peer-to-peer rental marketplace built for university students — rent textbooks, electronics, and lab equipment from other students across multiple campus locations.

**[Live Demo](https://rentify-one-gules.vercel.app)** · **[Report Bug](https://github.com/NikkyL49/Rentify/issues)**

---

## Overview

Rentify is a production-deployed web application that connects students who need to rent items with students who have items to list. Built with Next.js 14, Supabase, and deployed on Vercel.

The platform handles the full rental lifecycle — from listing and discovery through booking, approval, messaging, return, and seller ratings — with a separate admin dashboard for platform management.

---

## Screenshots

> Add screenshots here once deployed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript / JavaScript |
| Styling | Tailwind CSS v4 + custom CSS design tokens |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Deployment | Vercel |

---

## Features

### Student-facing
- **Browse & Search** — debounced full-text search, category filters, skeleton loading states, and Next.js `<Image>` with lazy loading
- **Item Listings** — create listings with photo upload, condition grading, daily/weekly/monthly pricing, deposit amount, and campus location
- **Rental Flow** — submit requests, track status (pending → active → returned), view receipts, and see overdue warnings with estimated late fees
- **Real-time Messaging** — Supabase Realtime `postgres_changes` subscriptions deliver messages instantly with optimistic UI updates and auto-scroll; no manual refresh needed
- **Unread Notifications** — live unread badge on the nav and per-conversation unread indicators, tracked via Realtime without any schema changes
- **Seller Ratings** — interactive star picker with hover states, color-coded labels, and a 500-character review field tied to completed rentals
- **Payment Methods** — saved cards with masked display (last 4 digits only), expiry validation, and per-rental payment selection
- **Profile Management** — avatar upload, contact info, and active rental summary

### Admin Dashboard (`/dashboard`)
- Separate login portal at `/admin-login` with role verification — non-admins are rejected before reaching the dashboard
- Stats overview: total items, active rentals, revenue, overdue count, suspended users
- Full CRUD for items, locations, and rental transactions
- User management with per-user rating averages, 1-star counts, active rental counts, and overdue flags
- **Auto-ban policy** — sellers are automatically suspended after 5 one-star ratings; users are flagged (⚠) when approaching the threshold
- Manual ban with reason field; banned users receive an automatic notification message
- Return processing with late fee and damage fee calculation

---

## Architecture Notes

### Real-time Messaging with Optimistic UI
Messages use a Supabase Realtime `postgres_changes` subscription scoped to the current user's ID. Sent messages are inserted optimistically (appear immediately in the UI with a temporary ID), then deduped when the server-confirmed row arrives via the subscription — eliminating the flicker of a pessimistic insert.

### Auth & Session Management
`AuthContext` wraps `supabase.auth.getSession()` and `onAuthStateChange` with graceful handling of stale refresh tokens — a common issue after DB resets or long idle sessions. Stale token errors are caught and silently cleared instead of flooding the console. A separate `profiles` table extends Supabase auth metadata without touching the auth schema directly.

### Access Control
Row Level Security policies are the primary data isolation layer. The `is_banned` flag is enforced end-to-end: checked at login, stored in `AuthContext`, and validated before any rental submission. Admin routes perform a direct `profiles` table lookup on sign-in — bypassing `AuthContext` to avoid a race condition between `user` and `isAdmin` state resolving.

### Next.js + Vercel Compatibility
`useSearchParams()` requires a Suspense boundary in Next.js App Router, which causes build failures on Vercel with static pre-rendering. URL params are read via `window.location.search` inside a `useEffect` instead — a client-safe pattern that builds cleanly without a Suspense wrapper.

### Shared Utilities
`fmtPrice`, `fmtDate`, and `CATEGORIES` are defined once in `src/lib/utils.ts` and imported across the codebase — replacing copy-pasted implementations that previously existed in 5+ files.

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema from `supabase/migrations/`

### Installation

```bash
git clone https://github.com/your-username/rentify
cd rentify
npm install
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Admin Access
Navigate to `/admin-login`. The signing-in account must have `role = 'admin'` in the `profiles` table.

---

## Project Structure

```
src/
├── app/
│   ├── admin-login/          # Separate admin login portal
│   ├── dashboard/            # Admin dashboard + sub-pages (items, users, locations, rentals)
│   ├── items/                # Browse, item detail, new listing, rent flow
│   ├── messages/             # Real-time messaging with unread tracking
│   ├── my-items/             # Owner dashboard — listing management + rental request approval
│   ├── my-rentals/           # Renter dashboard — active rentals, overdue warnings, receipts
│   ├── payment-methods/      # Saved payment methods with masked card display
│   ├── profile/              # Profile editing and avatar upload
│   └── rate/[rentalId]/      # Interactive star rating with auto-ban enforcement
├── components/
│   ├── AdminLayout.js        # Admin shell — sidebar, topbar, breadcrumb, avatar
│   ├── BrowseItems.tsx       # Search + category filter + debounced query + skeleton grid
│   ├── Header.js             # Student nav with live unread message badge
│   ├── ItemCard.js           # Listing card with Next/Image lazy loading
│   └── SkeletonCard.tsx      # Shimmer-animated loading placeholders
├── context/
│   ├── AuthContext.js        # Global auth — user, profile, isAdmin, isBanned, stale token handling
│   └── ToastContext.tsx      # App-wide toast notification system
└── lib/
    ├── utils.ts              # Shared: fmtPrice, fmtDate, CATEGORIES
    ├── profileHelpers.js     # Profile upsert, name resolution, bulk profile loading
    ├── fileHelpers.js        # Image file validation and filename sanitization
    └── supabaseClient.ts     # Supabase client singleton
```

---

## License

This project was developed as part of CMPT-315 Web Application Development and is shared for portfolio purposes.
