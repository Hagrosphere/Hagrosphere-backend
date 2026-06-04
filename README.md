# 🌿 Hagrosphere Backend API

Production-grade NestJS backend for the **Hagrosphere** agricultural platform — connecting farmers, buyers, diaspora investors, and agribusinesses across Africa.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Folder Structure](#folder-structure)
4. [Database Schema](#database-schema)
5. [Authentication Flow](#authentication-flow)
6. [RBAC System](#rbac-system)
7. [API Endpoints](#api-endpoints)
8. [Security Implementation](#security-implementation)
9. [Environment Setup](#environment-setup)
10. [Running Locally](#running-locally)
11. [Docker Deployment](#docker-deployment)
12. [Caching Strategy](#caching-strategy)
13. [Background Jobs](#background-jobs)
14. [File Upload Architecture](#file-upload-architecture)
15. [Email Service](#email-service)
16. [Testing Strategy](#testing-strategy)
17. [Frontend Flaws & Recommendations](#frontend-flaws--recommendations)
18. [Deployment Recommendations](#deployment-recommendations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HAGROSPHERE BACKEND                   │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │  NestJS  │   │Prisma ORM│   │   PostgreSQL 16   │    │
│  │ (v10)    │──▶│  Client  │──▶│   (primary DB)    │    │
│  └──────────┘   └──────────┘   └──────────────────┘    │
│       │                                                 │
│       ├──▶ Redis (rate limiting / caching / sessions)   │
│       ├──▶ Cloudinary (image storage / CDN)             │
│       ├──▶ Nodemailer (transactional email)             │
│       └──▶ Cron Jobs (token cleanup / job expiry)       │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **NestJS** over Express | Project complexity warrants full DI, modules, guards, interceptors, decorators |
| **Prisma** over TypeORM | Better type safety, migration system, soft-delete middleware |
| **Argon2id** over bcrypt | More memory-hard, recommended by OWASP for password hashing |
| **API versioning** (`/api/v1/`) | Enables non-breaking future changes |
| **Soft deletes** | Data recovery, audit compliance, referential integrity |
| **Refresh token rotation** | Security: each refresh issues a new pair; replay attack prevention |
| **Hashed refresh tokens** | Never store plain tokens in DB — hashed with SHA-256 |
| **Cloudinary** | Auto-optimizes images, global CDN, transformations on-the-fly |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 + TypeScript 5 |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Cache / Sessions | Redis 7 (ioredis) |
| Authentication | JWT (access + refresh), Passport.js |
| Password Hashing | Argon2id |
| File Storage | Cloudinary |
| Email | Nodemailer (SMTP) |
| Validation | class-validator + class-transformer |
| API Docs | Swagger / OpenAPI 3.0 |
| Containerization | Docker + Docker Compose |
| Background Jobs | @nestjs/schedule (cron) |
| Security | Helmet, CORS, rate limiting, XSS sanitization |

---

## Folder Structure

```
hagrosphere-backend/
├── prisma/
│   ├── schema.prisma          # Full DB schema with 12 models
│   ├── seed.ts                # Database seeder
│   └── migrations/            # Auto-generated migration files
│
├── src/
│   ├── main.ts                # Bootstrap: Helmet, CORS, versioning, Swagger
│   ├── app.module.ts          # Root module
│   │
│   ├── config/
│   │   ├── app.config.ts      # Typed configuration factory
│   │   └── redis.module.ts    # Global Redis provider
│   │
│   ├── database/
│   │   ├── database.module.ts # Global Prisma module
│   │   └── prisma.service.ts  # Prisma client + soft-delete middleware
│   │
│   ├── common/
│   │   ├── decorators/        # @CurrentUser, @Public, @Roles
│   │   ├── filters/           # HttpExceptionFilter (handles Prisma errors)
│   │   ├── guards/            # JwtAuthGuard, RolesGuard
│   │   └── interceptors/      # ResponseInterceptor, LoggingInterceptor
│   │
│   ├── shared/
│   │   └── utils/
│   │       └── pagination.util.ts  # buildPaginationMeta()
│   │
│   └── modules/
│       ├── auth/              # JWT auth, refresh rotation, email verify
│       │   ├── strategies/    # jwt-access, jwt-refresh, local
│       │   ├── dto/           # RegisterDto, LoginDto, ResetPasswordDto
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   └── token.service.ts
│       │
│       ├── users/             # Admin user management (CRUD, roles, status)
│       ├── equipment/         # Equipment listings (CRUD, filters, images)
│       ├── jobs/              # Job board (CRUD, filters, deadline handling)
│       ├── articles/          # Content hub (CRUD, tags, related articles)
│       ├── contact/           # Contact form + admin message management
│       ├── dashboard/         # Admin analytics, charts, activity feed
│       ├── upload/            # Cloudinary single + multi image upload
│       ├── admin/             # Site settings, newsletter subscribers
│       └── shared/
│           ├── audit.service.ts   # Write-safe audit logging
│           ├── email.service.ts   # Nodemailer + HTML templates
│           └── cron.service.ts    # Scheduled background jobs
│
├── docker-compose.yml         # PostgreSQL + Redis + API
├── Dockerfile                 # Multi-stage build
├── .env.example               # All required environment variables
└── tsconfig.json
```

---

## Database Schema

### Models & Relationships

```
User (1) ──── (M) RefreshToken      [token rotation]
User (1) ──── (M) AuditLog          [who did what]
User (1) ──── (M) ContactMessage    [optional link]
User (1) ──── (M) UserSession       [device tracking]

EquipmentCategory (1) ──── (M) Equipment
Equipment (1) ──── (M) EquipmentImage

JobCategory (1) ──── (M) Job

Article (M) ──── (M) ArticleTag     [many-to-many]

ContactMessage                       [standalone]
FileUpload                           [audit trail]
SiteSetting                          [key-value store]
NewsletterSubscriber                 [email list]
DashboardStat                        [cached metrics]
```

### Indexing Strategy

| Model | Indexes | Reason |
|-------|---------|--------|
| User | email, role, status, deletedAt | Login lookup, admin filters, soft-delete |
| Equipment | categoryId, status, isFeatured, location, pricePerDay, deletedAt | All filter combinations on listings page |
| Job | categoryId, status, type, isFeatured, deadline, deletedAt | Jobs board filters + deadline cron |
| Article | status, category, isFeatured, publishedAt, deletedAt | Published filter + featured query |
| RefreshToken | userId, token, expiresAt | Fast lookup on rotation; expiry cleanup |
| AuditLog | userId, action, resourceType, createdAt | Activity feed queries |
| ContactMessage | status, email, createdAt | Admin inbox filters |

### Soft Delete Strategy

Applied to: `User`, `Equipment`, `Job`, `Article`  
Implementation: Prisma middleware intercepts all find/delete operations to filter/redirect automatically. No query ever needs `WHERE deletedAt IS NULL` manually.

---

## Authentication Flow

```
REGISTRATION
────────────
1. POST /api/v1/auth/register
2. Hash password with Argon2id
3. Generate email verify token (crypto.randomBytes(32))
4. Store user with status: PENDING_VERIFICATION
5. Send verification email (non-blocking)
6. Return 201 + message

EMAIL VERIFICATION
──────────────────
1. GET /api/v1/auth/verify-email?token=<token>
2. Validate token + expiry (24h window)
3. Update: isEmailVerified=true, status=ACTIVE
4. Clear verify token fields

LOGIN
─────
1. POST /api/v1/auth/login
2. Find user by email (case-insensitive)
3. Check lockout (5 failed attempts → 15 min lockout)
4. Verify password with Argon2
5. Check isEmailVerified + status
6. Reset login attempts on success
7. Issue accessToken (15m JWT) + refreshToken (7d JWT)
8. Store SHA-256 hashed refreshToken in DB
9. Set refreshToken as HttpOnly cookie (path restricted)
10. Return accessToken + user object in body

REFRESH TOKEN ROTATION
──────────────────────
1. POST /api/v1/auth/refresh (reads cookie)
2. Verify JWT signature + expiry
3. Look up hashed token in DB
4. If revoked/missing: revoke ALL user tokens (reuse attack!)
5. Mark old token as revoked
6. Issue new token pair
7. Set new cookie

LOGOUT
──────
1. POST /api/v1/auth/logout
2. Revoke the specific refresh token
3. Clear cookie
4. Write audit log

ADMIN LOGIN
───────────
Same as login + role check after tokens issued.
If role is not ADMIN/SUPER_ADMIN, tokens are immediately revoked.
```

---

## RBAC System

| Role | Description | Capabilities |
|------|-------------|-------------|
| `USER` | Regular registered user | Contact form, newsletter |
| `ADMIN` | Platform administrator | Full CRUD on equipment/jobs/articles, manage users, view dashboard |
| `SUPER_ADMIN` | Root administrator | Everything + change roles, delete users, update site settings |

### Guard Chain

```
Request → JwtAuthGuard → RolesGuard → Controller
               │               │
               ▼               ▼
         Validates JWT    Checks @Roles()
         + user status    decorator value
```

`@Public()` decorator bypasses JwtAuthGuard entirely for public endpoints.

---

## API Endpoints

### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | Public | Register new user |
| POST | `/login` | Public | Login, get access token |
| POST | `/admin/login` | Public | Admin login (role-checked) |
| POST | `/refresh` | Cookie | Rotate refresh token |
| POST | `/logout` | JWT | Logout, revoke token |
| GET | `/verify-email?token=` | Public | Verify email |
| POST | `/forgot-password` | Public | Request password reset |
| POST | `/reset-password` | Public | Reset with token |
| GET | `/me` | JWT | Get current user |

### Equipment — `/api/v1/equipment`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | List with filters/pagination |
| GET | `/categories` | Public | List categories |
| GET | `/:slug` | Public | Get single (increments views) |
| POST | `/` | ADMIN | Create listing |
| PATCH | `/:id` | ADMIN | Update listing |
| DELETE | `/:id` | ADMIN | Soft delete |

**Query params:** `page, limit, search, category, status, condition, location, minPrice, maxPrice, featured, sortBy, sortOrder`

### Jobs — `/api/v1/jobs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | List open jobs |
| GET | `/categories` | Public | Job categories |
| GET | `/:slug` | Public | Single job (views++) |
| GET | `/admin/all` | ADMIN | All jobs (all statuses) |
| POST | `/` | ADMIN | Create job |
| PATCH | `/:id` | ADMIN | Update job |
| DELETE | `/:id` | ADMIN | Soft delete |

### Articles — `/api/v1/articles`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Published articles |
| GET | `/tags` | Public | All tags |
| GET | `/:slug` | Public | Single + related articles |
| GET | `/admin/all` | ADMIN | All (all statuses) |
| POST | `/` | ADMIN | Create article |
| PATCH | `/:id` | ADMIN | Update article |
| DELETE | `/:id` | ADMIN | Soft delete |

### Contact — `/api/v1/contact`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Public (throttled 3/min) | Submit contact form |
| GET | `/` | ADMIN | List messages |
| PATCH | `/:id/read` | ADMIN | Mark as read |
| PATCH | `/:id/replied` | ADMIN | Mark as replied |

### Dashboard — `/api/v1/dashboard`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/overview` | ADMIN | Stats, charts, recent items |
| GET | `/activity` | ADMIN | Audit log / activity feed |

### Users — `/api/v1/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | ADMIN | List users |
| GET | `/stats` | ADMIN | User statistics |
| GET | `/:id` | ADMIN | Single user |
| PATCH | `/:id/role` | SUPER_ADMIN | Change role |
| PATCH | `/:id/status` | ADMIN | Suspend / activate |
| DELETE | `/:id` | SUPER_ADMIN | Soft delete |

### Upload — `/api/v1/upload`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/image?folder=` | ADMIN | Single image → Cloudinary |
| POST | `/images?folder=` | ADMIN | Multi images (max 10) |
| DELETE | `/:publicId` | ADMIN | Delete from Cloudinary |

### Admin — `/api/v1/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Health check |
| POST | `/newsletter/subscribe` | Public | Subscribe |
| POST | `/newsletter/unsubscribe` | Public | Unsubscribe |
| GET | `/settings` | ADMIN | Get site settings |
| PATCH | `/settings/:key` | SUPER_ADMIN | Update setting |
| PATCH | `/settings` | SUPER_ADMIN | Bulk update settings |
| GET | `/newsletter/subscribers` | ADMIN | List subscribers |

---

## Security Implementation

### Layers of Security

```
1. NETWORK LAYER
   └── Helmet HTTP headers (X-Frame-Options, HSTS, CSP in prod)
   └── CORS (allowlist-only origins, credentials)
   └── Rate limiting (global: 200/min, auth: 5/min, contact: 3/min)

2. INPUT LAYER
   └── ValidationPipe (whitelist: true — strips unknown fields)
   └── class-validator decorators on all DTOs
   └── XSS sanitization (xss library) on contact form
   └── File type + size validation on uploads
   └── SQL injection: prevented by Prisma parameterized queries

3. AUTHENTICATION LAYER
   └── Argon2id (memory-hard, OWASP recommended)
   └── Access tokens: 15-minute expiry (short window)
   └── Refresh tokens: 7-day, HttpOnly cookie (no JS access)
   └── Tokens hashed (SHA-256) before DB storage
   └── Refresh token rotation (new pair on every use)
   └── Token reuse detection → revoke ALL user tokens
   └── Brute force protection: 5 attempts → 15min lockout

4. AUTHORIZATION LAYER
   └── JwtAuthGuard on all non-public routes
   └── RolesGuard enforces RBAC
   └── User status check on every request (suspended users blocked)
   └── Resource ownership validation where applicable

5. AUDIT LAYER
   └── AuditLog table records every critical action
   └── Includes: userId, action, resource, IP, userAgent, metadata
   └── Non-blocking (never fails the main request)
```

### Password Security

- **Algorithm**: Argon2id
- **Parameters**: memoryCost=65536 (64MB), timeCost=3, parallelism=4
- **Reset flow**: secure random token (32 bytes hex), 1-hour expiry, invalidates all sessions on use

---

## Environment Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate secure secrets
openssl rand -hex 64  # → JWT_ACCESS_SECRET
openssl rand -hex 64  # → JWT_REFRESH_SECRET
openssl rand -hex 32  # → COOKIE_SECRET

# 3. Fill in Cloudinary credentials (create free account at cloudinary.com)
# 4. Fill in SMTP credentials (Gmail App Password or SendGrid)
# 5. Set DATABASE_URL with your PostgreSQL connection string
```

---

## Running Locally

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:dev

# Seed database (creates admin user + categories)
npm run prisma:seed

# Start development server
npm run start:dev

# API available at: http://localhost:3001
# Swagger docs at:  http://localhost:3001/api/docs
```

---

## Docker Deployment

```bash
# Start all services (API + PostgreSQL + Redis)
docker-compose up -d

# View logs
docker-compose logs -f api

# Run migrations inside container
docker-compose exec api npx prisma migrate deploy

# Seed (first time only)
docker-compose exec api npm run prisma:seed

# Stop all services
docker-compose down
```

---

## Caching Strategy

| Data | Cache Layer | TTL | Invalidation |
|------|-------------|-----|-------------|
| Dashboard stats | DashboardStat table | 1 hour (cron) | Cron refresh |
| Session data | Redis (future) | 24h | On logout |
| Rate limit counters | Redis (throttler) | Per-window | Auto-expire |

> **Note**: Redis is wired in via the global `RedisModule` and injected via `REDIS_CLIENT` token. Future caching of hot endpoints (equipment list, articles) can use the existing Redis client by injecting it into services.

---

## Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `purgeExpiredTokens` | Daily 2am | Delete expired/revoked refresh tokens |
| `closeExpiredJobs` | Daily 3am | Auto-close jobs past deadline |
| `refreshDashboardStats` | Every hour | Update cached dashboard metrics |
| `archiveOldMessages` | Weekly Sunday | Archive unread messages >90 days |

---

## File Upload Architecture

```
Frontend → POST /api/v1/upload/image
         ↓
    Multer (memory storage, 10MB limit)
         ↓
    File type validation (JPEG, PNG, WebP only)
    Size validation (max 5MB for images)
         ↓
    Cloudinary upload stream
    Auto-transform: quality=auto, format=auto, max 1200×900
         ↓
    Log to FileUpload table
         ↓
    Return { url, publicId, format, width, height, size }
```

Images are uploaded to: `hagrosphere/{folder}/` in Cloudinary.  
`publicId` is stored so images can be deleted when equipment/articles are removed.

---

## Email Service

Templates use inline HTML with the Hagrosphere green brand color (`#2d6a4f`).

| Trigger | Email Sent |
|---------|-----------|
| Registration | Email verification link |
| Password reset request | Reset link (1-hour expiry) |
| Contact form submission | Confirmation to user + notification to admin |

---

## Testing Strategy

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.service.spec.ts      # Test: register, login, token rotation
│   │   └── token.service.spec.ts     # Test: JWT generation, rotation, revocation
│   ├── equipment/
│   │   └── equipment.service.spec.ts # Test: CRUD, slug generation, soft delete
│   └── ...
└── test/
    ├── app.e2e-spec.ts               # Full request lifecycle tests
    └── jest-e2e.json
```

### What to Test

- Auth: registration, login failure, lockout, token rotation, reuse attack
- Services: all CRUD operations, pagination, filters, slug uniqueness
- Guards: public routes accessible, protected routes blocked, role enforcement
- Error handling: 404s, 409 conflicts, 400 validation errors

---

## Frontend Flaws & Recommendations

### Issues Identified

| Issue | Location | Risk | Fix |
|-------|----------|------|-----|
| `DummyData.jsx` in production build | `src/components/DummyData.jsx` | **HIGH** — fake data served to users | Remove; use real API data |
| No API error boundary | All pages | **MEDIUM** — crashes on network failure | Add global error boundary + retry |
| Admin routes rely on frontend-only `ProtectedRoute` | `src/components/ProtectedRoute.jsx` | **HIGH** — server must also enforce RBAC | ✅ Backend guards all admin endpoints |
| No token refresh logic visible | Auth flow | **MEDIUM** — users get logged out after 15m | Implement Axios interceptor to auto-refresh |
| Hardcoded `AdminLogin` redirect | `src/pages/AdminLogin.jsx` | **LOW** | Should rely on role returned from `/auth/me` |

### Recommended Frontend Changes

```javascript
// 1. Axios interceptor for token refresh
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
      return axiosInstance(error.config);
    }
    return Promise.reject(error);
  }
);

// 2. Standardized API response handler
// All responses have shape: { success, data, meta?, message? }
// Error responses: { success: false, statusCode, message, errors? }
```

---

## Deployment Recommendations

### Staging / Production

| Service | Recommended Provider |
|---------|---------------------|
| API | Railway, Render, or AWS ECS |
| PostgreSQL | Supabase, Railway, or AWS RDS |
| Redis | Upstash (serverless) or Railway |
| Images | Cloudinary (already integrated) |
| Email | SendGrid or AWS SES (replace SMTP) |
| Domain / SSL | Cloudflare |
| Frontend | Vercel (already likely there) |

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] All secrets are 64+ character random strings
- [ ] `ALLOWED_ORIGINS` only contains production frontend URL
- [ ] Swagger docs disabled (auto-disabled in production)
- [ ] Database backups configured
- [ ] Redis persistence enabled (`--appendonly yes`)
- [ ] Change default admin password immediately after seed
- [ ] Configure Cloudflare WAF rules
- [ ] Set up error monitoring (Sentry)
- [ ] Set up uptime monitoring (Better Uptime / UptimeRobot)
