# Supabase Setup Guide

BUY BEE stores all data in **Supabase PostgreSQL**. The Express backend is the only component that talks to the
database, using the Supabase **service role key**. The React frontend never connects to Supabase directly.

Authentication is still handled by the backend (bcrypt password hashes + JWT); Supabase Auth is not used.

## 1. Create the project

1. Go to https://supabase.com/dashboard and create a new project (pick the region closest to your Render backend).
2. Wait until the project is provisioned.

## 2. Create the schema

Open **SQL Editor** in the Supabase dashboard and run these files **in order** (paste the file content and click *Run*):

1. `server/supabase/migrations/0001_initial_schema.sql` - tables, constraints, indexes, triggers
2. `server/supabase/migrations/0002_functions.sql` - transactional functions (checkout, cancel, cart, coupons, dashboard)
3. `server/supabase/migrations/0003_security.sql` - Row Level Security + privileges

Alternatively, with the Supabase CLI (`supabase link --project-ref <ref>`), copy the files into `supabase/migrations`
and run `supabase db push`.

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Users (name, email, bcrypt `password_hash`, role `customer`/`admin`, active flag, reset token) |
| `addresses` | User addresses (one default per user, enforced by trigger) |
| `categories` | Product categories (unique name and slug) |
| `products` | Products (price, stock, SKU, `specifications` JSON, tags, cached rating, full-text `search_vector`) |
| `carts` / `cart_items` | One cart per user, one row per product (`unique (cart_id, product_id)`) |
| `wishlists` / `wishlist_items` | One wishlist per user, one row per product (`unique (wishlist_id, product_id)`) |
| `coupons` | Discount codes (percent / fixed, min order, max discount, usage limit, expiry) |
| `orders` / `order_items` | Orders with snapshot of shipping address and purchased items |
| `order_status_history` | Status timeline of every order |
| `reviews` | One review per user and product, tied to a delivered order; product rating kept in sync by trigger |

Every table that existed in MongoDB has a `legacy_mongo_id` column holding the original ObjectId (filled by the
migration script, `null` for new rows). No `payments` table is created because the app only tracks payment method
and status on the order.

### Security model

- RLS is **enabled and forced** on every table and **no policies** are defined, and all privileges are revoked
  from the `anon` and `authenticated` roles. The public anon key therefore cannot read or write anything.
- Only the `service_role` key (used by the backend) has access.
- Authorization (who can see which order, admin-only routes, etc.) is enforced in the Express API.

## 3. Configure the backend

From **Project Settings -> API** copy:

- **Project URL** -> `SUPABASE_URL`
- **service_role secret** -> `SUPABASE_SERVICE_ROLE_KEY`

```env
# server/.env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # secret - backend only
```

> Never put the service role key in `client/.env`, in any `VITE_*` variable, or in source control.
> It bypasses RLS and gives full database access.

## 4. Seed demo data (optional)

```bash
cd server
npm run seed            # refuses to run if the database already has users/products/orders
npm run seed -- --force # DELETES ALL DATA and reseeds (development only)
```

## 5. Migrate existing MongoDB data (optional)

`server/scripts/migrate-mongo-to-supabase.js` copies an existing BUY BEE MongoDB database into Supabase.

- MongoDB is only **read**; nothing is deleted or modified there.
- A full Extended-JSON backup of every collection is written to `server/backups/` first (git-ignored).
- ObjectIds are mapped to deterministic UUIDs, so relationships are preserved and re-running the script is safe
  (existing rows are never overwritten).
- Users keep their passwords (bcrypt hashes are copied) and existing JWTs keep working until they expire.
- Invalid or orphaned records (duplicate emails, cart items pointing to deleted products, ...) are skipped and
  listed as warnings.
- After writing, the script verifies every planned row exists in Supabase.

```bash
cd server
# MONGODB_URI plus the SUPABASE_* variables must be set (in server/.env or the shell)
MONGODB_URI="mongodb+srv://..." npm run migrate:mongo                # dry run: backup + report, writes nothing
MONGODB_URI="mongodb+srv://..." npm run migrate:mongo -- --execute   # backup + migrate + verify
```

Run it against an **empty** Supabase project (do not run `npm run seed` first). The script aborts if it finds
rows that did not come from the migration, unless you pass `--allow-existing`.

Keep the MongoDB database until you have verified the application on Supabase.

## 6. Local development without a Supabase project

`server/supabase/local` contains a Docker Compose stack (Postgres 15 + PostgREST + nginx) that exposes the same
REST API as Supabase. See `server/supabase/README.md`. You can also use the official `supabase start` CLI.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY` | Set both variables in `server/.env` / Render |
| `Supabase connection failed: ...` at startup | Check the URL, that the key is the **service_role** key (not anon), and that the migrations were run |
| `permission denied for table ...` | You are using the anon key, or `0003_security.sql` grants were not applied |
| `Could not find the function ...` | Run `0002_functions.sql`, then `notify pgrst, 'reload schema';` |
