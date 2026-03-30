# HouseLink API

A property rental/booking platform backend built with Node.js, TypeScript, Express, and PostgreSQL.

**Live API:** https://houselink-backend-i9ig.onrender.com
**API Docs:** https://houselink-backend-i9ig.onrender.com/api/docs
**Frontend:** https://houselink.com.ng

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Properties](#properties)
  - [Chat](#chat)
  - [Payments & Escrow](#payments--escrow)
  - [Payouts](#payouts)
  - [Availability](#availability)
  - [Reviews](#reviews)
  - [Wishlist](#wishlist)
  - [Notifications](#notifications)
  - [Admin](#admin)
  - [Uploads](#uploads)
- [Roles & Permissions](#roles--permissions)
- [Payment Flow](#payment-flow)
- [Real-time Events (Socket.io)](#real-time-events-socketio)
- [Database Schema](#database-schema)
- [Running Migrations](#running-migrations)
- [Cron Jobs](#cron-jobs)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL (Neon serverless) |
| ORM | Knex.js |
| Auth | JWT (access token) + HTTP-only cookie (refresh token) |
| Payments | Paystack |
| Email | Resend |
| File storage | Cloudinary |
| Real-time | Socket.io |
| Newsletter | Mailchimp |
| Bot protection | Google reCAPTCHA |
| Docs | Swagger / OpenAPI |

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Run database migrations
npx knex migrate:latest

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | Full PostgreSQL connection string (or use individual PG* vars below) |
| `PGHOST` | Postgres host |
| `PGDATABASE` | Postgres database name |
| `PGUSER` | Postgres user |
| `PGPASSWORD` | Postgres password |
| `PGSSLMODE` | SSL mode (`require` for Neon) |
| `SECRET_KEY` | JWT signing secret |
| `PAYSTACK_SECRET_KEY` | Paystack secret key — used for API calls **and** webhook signature verification |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `FRONTEND_URL` | Comma-separated allowed frontend origins e.g. `https://houselink.com.ng,https://www.houselink.com.ng` |
| `SMTP_HOST` | SMTP server hostname (e.g. `mail.houselink.com.ng`) |
| `SMTP_PORT` | SMTP port — `587` (STARTTLS) or `465` (SSL) |
| `SMTP_SECURE` | `true` for port 465, `false` for 587 |
| `SMTP_USER` | SMTP login — `contact@houselink.com.ng` |
| `SMTP_PASS` | SMTP password for the above account |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v2 secret |
| `MAILCHIMP_API_KEY` | Mailchimp API key |
| `MAILCHIMP_LIST_ID` | Mailchimp audience/list ID |

> **Webhook Note:** Paystack signs webhook payloads with your `PAYSTACK_SECRET_KEY` via HMAC SHA512. There is no separate webhook secret — the same key is used for both API calls and signature verification.

---

## Architecture

```
src/
├── config/          # DB, logger, Swagger, Cloudinary config
├── controllers/     # Request handlers
├── jobs/            # Cron jobs
├── middleware/      # Auth, upload middleware
├── migrations/      # Knex database migrations
├── routes/          # Express routers
├── seeds/           # Development seed data
├── services/        # Business logic (email, Paystack transfers)
├── shared/enums/    # DB table name constants
├── types/           # TypeScript type extensions
└── index.ts         # App entry point, Socket.io, rate limiting
```

---

## API Reference

### Authentication

Base path: `/api/auth`

All auth endpoints are rate-limited to **20 requests per 15 minutes**.

Login is a 2-step process: password check → OTP verification.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/send-otp` | Public | Send OTP to email. `type`: `signup`, `login`, or `password_reset` |
| POST | `/register` | Public | Register new user. Requires OTP from `send-otp` (type=signup). `role`: `seeker` (default) or `owner` |
| POST | `/login` | Public | Step 1: verify password, sends login OTP |
| POST | `/login/verify` | Public | Step 2: verify OTP, returns access token + sets refresh cookie |
| POST | `/forgot-password` | Public | Send password reset OTP (silent if email not found) |
| POST | `/reset-password` | Public | Reset password with OTP |
| POST | `/refresh` | Public | Rotate refresh cookie → new access token |
| POST | `/logout` | Auth | Invalidate refresh token, clear cookie |
| GET | `/me` | Auth | Get current user profile |
| PUT | `/profile` | Auth | Update name, phone, avatar |
| PUT | `/change-password` | Auth | Change password (requires current password) |

**Password requirements:** minimum 8 characters, must include at least one number or special character.

**OTP TTL:** 10 minutes.
**Access token TTL:** 15 minutes.
**Refresh token TTL:** 7 days.

---

### Properties

Base path: `/api/properties`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | List properties with filtering and pagination |
| GET | `/:id` | Public | Get single property (increments view counter) |
| POST | `/` | Owner | Create listing (multipart/form-data with `media` files) |
| PUT | `/:id` | Owner | Update listing (field whitelist enforced) |
| DELETE | `/:id` | Owner | Soft-delete listing |
| GET | `/owner/analytics` | Owner | Dashboard: views, wishlist counts, reviews, message counts |

**Query parameters for `GET /`:**

| Param | Type | Description |
|---|---|---|
| `search` | string | Full-text search on title, description, location |
| `type` | string | `Apartment`, `House`, `Studio`, `Duplex`, `Bungalow`, `Self-contain`, `Office` |
| `minPrice` | number | Minimum price filter |
| `maxPrice` | number | Maximum price filter |
| `rooms` | integer | Number of rooms |
| `amenity` | string | Filter by amenity (partial match) |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 12) |

Deleted properties (`deleted_at IS NOT NULL`) are excluded from all public queries.

---

### Chat

Base path: `/api/chat`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Auth | Send a message. Body: `{ receiver_id, property_id, message }` |
| GET | `/:property_id` | Auth | Get messages for a conversation. Auto-marks received messages as read and emits `messagesRead` socket event |
| GET | `/unread-count` | Auth | Total unread message count for current user |

Sending a message triggers an in-app notification and an email to the receiver.

---

### Payments & Escrow

Base path: `/api/payment`

Rate-limited to **30 requests per hour**.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/initialize` | Auth | Initialize Paystack transaction and create escrow record |
| GET | `/verify` | Auth | Verify payment status by reference |
| POST | `/:id/confirm-checkin` | Auth (Seeker) | Confirm arrival → release escrow to owner |
| POST | `/:id/release` | Auth (Owner) | Request auto-release (only available 24h after check-in date if seeker hasn't confirmed) |
| POST | `/:id/dispute` | Auth (Seeker) | Raise a dispute — blocks escrow release pending admin review |
| POST | `/:id/dispute/resolve` | Admin | Resolve dispute: `{ action: "release" \| "refund" }` |

**Escrow states:** `held` → `released` / `refunded` / `failed`
**Dispute states:** `open` → `resolved` / `dismissed`

---

### Payouts

Base path: `/api/payout`

Rate-limited to **15 requests per hour**.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/banks` | Public | List Nigerian banks (used for bank selector UI) |
| POST | `/resolve-account` | Public | Verify bank account number. Body: `{ account_number, bank_code }` |
| GET | `/bank-account` | Owner | Get saved payout account |
| POST | `/bank-account` | Owner | Save/replace payout account. Triggers a security alert email to the owner |
| DELETE | `/bank-account` | Owner | Remove payout account |
| GET | `/history` | Owner | Payout history with escrow status |

Platform fee: **5%** deducted from each payout.

---

### Availability

Base path: `/api/properties/:property_id/availability`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | Get available and blocked dates for a property |
| POST | `/` | Owner | Add availability slot. Body: `{ available_from, available_to, is_blocked? }` |
| DELETE | `/:id` | Owner | Remove availability slot |

---

### Reviews

Base path: `/api/reviews`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Auth | Create review. Body: `{ property_id, rating (1–5), comment }`. One review per user per property |
| PUT | `/:review_id` | Auth | Update own review |
| DELETE | `/:review_id` | Auth | Delete own review |
| GET | `/:property_id` | Public | Get all reviews for a property |

---

### Wishlist

Base path: `/api/wishlist`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Auth | Add property to wishlist. Body: `{ property_id }` |
| DELETE | `/:property_id` | Auth | Remove from wishlist |
| GET | `/` | Auth | Get current user's wishlist |

---

### Notifications

Base path: `/api/notifications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Auth | Get last 50 notifications for current user |
| PUT | `/read-all` | Auth | Mark all notifications as read |
| PUT | `/:id/read` | Auth | Mark single notification as read |

**Notification types:** `message`, `payment`, `booking`, `dispute`, `property`, `account`

Notifications are auto-created by the system for:
- New messages received
- Payment held in escrow after booking
- New booking received (owner)
- Check-in confirmed / escrow released
- Dispute raised / resolved
- Property verified or rejected
- Account suspended

---

### Admin

Base path: `/api/admin`

Requires `role: admin`. All endpoints are protected by `authMiddleware + requireRole("admin")`.

**Users**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List all users. Query: `role`, `search`, `page`, `limit` |
| POST | `/users/:id/suspend` | Suspend a user (invalidates all sessions) |
| POST | `/users/:id/unsuspend` | Lift suspension |
| DELETE | `/users/:id` | Hard delete a user |

**Properties**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/properties` | List all properties including unverified. Query: `verified`, `page`, `limit` |
| POST | `/properties/:id/verify` | Verify a property listing |
| POST | `/properties/:id/reject` | Reject (soft-delete) a property. Body: `{ reason? }` |

**Disputes**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/disputes` | List all open payment disputes |

> To create an admin user, set `role = 'admin'` directly in the database.

---

### Uploads

Base path: `/api/uploads`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/media` | Auth | Upload images/videos to Cloudinary. Field: `media` (multipart). Returns array of URLs |

---

### Newsletter Subscription

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/subscribe` | Public | Subscribe email to Mailchimp. Body: `{ email, token }` (reCAPTCHA token required). Rate-limited to 5/hour |

---

### Webhook

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/webhook/paystack` | Paystack webhook handler. Signature verified using `PAYSTACK_SECRET_KEY` |

**Handled events:**
- `charge.success` — marks payment as success, holds escrow, sends confirmation emails to seeker and owner, creates in-app notifications
- `transfer.success` — marks escrow as released
- `transfer.failed` / `transfer.reversed` — marks escrow as failed
- `charge.failed` — marks payment as failed

---

## Roles & Permissions

| Role | Description |
|---|---|
| `seeker` | Default role. Can search properties, book, chat, review, wishlist |
| `owner` | Can list properties, manage availability, receive payouts |
| `admin` | Full platform access: verify/reject listings, suspend users, resolve disputes |

Suspended users are rejected on every authenticated request regardless of token validity.

---

## Payment Flow

```
1. Seeker calls POST /api/payment/initialize
   → Paystack transaction created, payment record (status=pending, escrow=held) saved

2. Seeker completes payment on Paystack hosted page

3. Paystack sends charge.success webhook
   → Payment marked status=success
   → Confirmation email sent to seeker (with confirm check-in link)
   → Booking notification email sent to owner
   → In-app notifications created for both parties

4a. Seeker confirms check-in via POST /api/payment/:id/confirm-checkin
    → releaseEscrow() called → Paystack transfer initiated to owner's bank
    → Receipt emails sent to both parties
    → In-app notifications created

4b. If seeker doesn't confirm within 24h of check-in date:
    → Owner can call POST /api/payment/:id/release to auto-release

4c. If there's a problem:
    → Seeker calls POST /api/payment/:id/dispute with a reason
    → Escrow release is blocked
    → Admin reviews via GET /api/admin/disputes
    → Admin resolves via POST /api/payment/:id/dispute/resolve
      - action="release" → pays owner
      - action="refund"  → marks for manual refund

5. Paystack sends transfer.success webhook
   → escrow_status updated to "released"
```

---

## Real-time Events (Socket.io)

Connect to the server with Socket.io and join a property room to receive events.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `joinRoom` | `"property-{property_id}"` | Join a property chat room |
| `sendMessage` | `{ property_id, message, ... }` | Send a message (also persisted via REST) |
| `typing` | `{ property_id, user_id }` | Notify others that user is typing |
| `stopTyping` | `{ property_id, user_id }` | Notify others that user stopped typing |
| `messagesRead` | `{ property_id, reader_id }` | Emit when user reads messages (also emitted automatically by GET /chat/:property_id) |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `receiveMessage-{property_id}` | message object | New message in the property room |
| `userTyping` | `{ user_id, property_id }` | Another user is typing |
| `userStopTyping` | `{ user_id, property_id }` | Another user stopped typing |
| `messagesRead` | `{ property_id, reader_id }` | Messages were read by another user |

---

## Database Schema

| Table | Key Columns |
|---|---|
| `users` | id, name, email, password, role, suspended_at, created_at |
| `properties` | id, owner_id, title, description, price, location, type, rooms, amenities, images[], videos[], verified, views, is_available, deleted_at |
| `payments` | id, user_id, owner_id, property_id, status, escrow_status, reference, amount, platform_fee, owner_amount, checkin_date, checkout_date, seeker_confirmed_at, transfer_reference, dispute_status, dispute_reason, disputed_at, deleted_at |
| `messages` | id, sender_id, receiver_id, property_id, message, is_read, created_at |
| `reviews` | id, user_id, property_id, rating, comment, created_at |
| `wishlists` | id, user_id, property_id |
| `notifications` | id, user_id, type, title, body, link, is_read, created_at |
| `property_availability` | id, property_id, available_from, available_to, is_blocked |
| `bank_accounts` | id, owner_id, account_number, account_name, bank_name, bank_code, recipient_code, is_default |
| `refresh_tokens` | id, user_id, token, expires_at |
| `otp_codes` | id, email, code, type, expires_at, used |

---

## Running Migrations

```bash
# Run all pending migrations
npx knex migrate:latest

# Rollback last batch
npx knex migrate:rollback

# Rollback all
npx knex migrate:rollback --all

# Check migration status
npx knex migrate:status
```

---

## Cron Jobs

Two background jobs run automatically on server start:

| Schedule | Job | Description |
|---|---|---|
| Daily at 00:00 | Expire listings | Marks properties past their availability end date as unavailable |
| Daily at 02:00 | Purge tokens | Deletes expired refresh tokens and used OTP codes from the database |
