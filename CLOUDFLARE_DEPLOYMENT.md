# Cloudflare Workers + D1 Deployment Guide for Tallix

Tallix is configured with a **Local-First, Cloudflare-Synchronized** architecture:
- **Client**: Runs on IndexedDB (`tallix_offline_v1`) as the primary database with an in-memory mutation queue and Service Worker offline caching.
- **Sync Protocol**: Bidirectional incremental synchronization with idempotent mutation deduplication (`POST /api/sync/push` and `GET /api/sync/pull`).
- **Server / Edge**: Runs on Cloudflare Workers with Cloudflare D1 distributed SQLite database (with fallback to local Express server in preview/development).

---

## 1. Prerequisites

Make sure you have Wrangler (the Cloudflare Developer CLI) installed:
```bash
npm install -g wrangler
# or use npx wrangler
```

Log in to your Cloudflare account:
```bash
npx wrangler login
```

---

## 2. Create the Cloudflare D1 Database

Run the following command to create the production D1 database:
```bash
npx wrangler d1 create tallix-db
```

Wrangler will output configuration information similar to:
```jsonc
[[d1_databases]]
binding = "DB"
database_name = "tallix-db"
database_id = "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` value and update it inside `wrangler.jsonc`.

---

## 3. Apply the Database Migrations

Apply the database schema to the remote Cloudflare D1 database:
```bash
npx wrangler d1 migrations apply tallix-db --remote
```

To test migrations locally with Wrangler:
```bash
npx wrangler d1 migrations apply tallix-db --local
```

---

## 4. Configure Worker Secrets (Resend Email & Gemini)

### A. Configure RESEND_API_KEY (Required for Email Verification)
To enable server-side transactional email verification via Resend without exposing keys to the client:

**Via Wrangler CLI:**
```bash
npx wrangler secret put RESEND_API_KEY
```
When prompted, paste your Resend API key (`re_...`).

**Via Cloudflare Dashboard:**
1. Navigate to **Workers & Pages** > **tallix-worker** > **Settings** > **Variables and Secrets**.
2. Click **Add Secret** (or **Add** under Environment Variables).
3. Set Variable Name to: `RESEND_API_KEY`
4. Paste your Resend API key into the value field, encrypt/save.

*(Optional)* If you have verified your custom domain in Resend and want to change the sender from the default onboarding sender (`Tallix <onboarding@resend.dev>`):
```bash
npx wrangler secret put RESEND_FROM_EMAIL
# Example: Tallix <noreply@yourdomain.com>
```

### B. (Optional) Configure Gemini API Key Secret
If you want the Cloudflare Worker to serve the AI Copilot directly from the edge:
```bash
npx wrangler secret put GEMINI_API_KEY
```

---

## 5. Deploy the Cloudflare Worker

Deploy the Worker script to Cloudflare's global edge network:
```bash
npx wrangler deploy
```

> **Note on Redeployment after adding secrets:**
> - When you add or update secrets via `npx wrangler secret put RESEND_API_KEY` or the Cloudflare Dashboard, Cloudflare automatically activates a new deployment with that secret bound.
> - **However**, because `worker/index.ts` has been updated with the server-side Resend transactional delivery pipeline and trimmed credential handlers, you **must run `npx wrangler deploy`** once to deploy the latest code to Cloudflare edge.

Once deployed, your Cloudflare Worker will expose:
- `GET /api/health` — Edge health check and D1 database connectivity status
- `POST /api/auth/send-verification` — Edge OTP generation and Resend email dispatch
- `POST /api/auth/verify-code` — Edge OTP validation and single-use invalidation
- `POST /api/auth/register` — Authoritative D1 user creation
- `POST /api/sync/push` — Idempotent mutation push endpoint
- `GET /api/sync/pull` — Incremental delta sync pull endpoint
- `POST /api/gemini/chat` — Edge AI chat endpoint
- `POST /api/gemini/analyze` — Edge financial analysis endpoint

---

## 6. Offline-First Guarantees

1. **Uninterrupted Offline Operations**:
   - All creates, updates, deletes, status changes, group operations, and debt settlements execute immediately against local IndexedDB.
   - User transactions and balance computations are zero-latency.

2. **Guaranteed Delivery (Retry & Backoff)**:
   - When offline or when network packets drop, mutations are safely persisted in the `syncQueue` store.
   - As soon as connectivity resumes, `syncEngine` flushes mutations in order with exponential backoff.

3. **Idempotency & Conflict Safety**:
   - Every mutation has a collision-resistant UUID (`mutationId`).
   - Re-sent or duplicated mutations are recognized and acknowledged without duplicate execution.

4. **Deterministic Minor Unit Arithmetic**:
   - Monetary values are rounded to 2 decimal places and stored with integer minor units (`amount_paisa = Math.round(amount * 100)`) preventing floating-point rounding errors.
