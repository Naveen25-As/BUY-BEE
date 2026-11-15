# Supabase database

- `migrations/` - SQL to run on the Supabase project, in order (see `../../SUPABASE_SETUP.md`).
- `local/` - Supabase-compatible local stack for development and the API test suite.

## Local stack

```bash
cd server/supabase/local
docker compose up -d --wait          # Postgres on :54322, REST gateway on :54321
```

The migrations are applied automatically on the first start. To reset the database: `docker compose down -v`.

The REST API checks JWTs signed with `LOCAL_JWT_SECRET` (default `local-dev-only-jwt-secret-at-least-32-chars`).
Create a local service-role key with:

```bash
node -e "console.log(require('jsonwebtoken').sign({role:'service_role'}, 'local-dev-only-jwt-secret-at-least-32-chars', {expiresIn:'10y'}))"
```

and put it in `server/.env`:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<token printed above>
```

## API tests

The end-to-end test suite runs real HTTP requests against a running server and a freshly seeded database:

```bash
cd server
npm run seed -- --force
RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start   # in another terminal
npm run test:api                                            # API_URL defaults to http://localhost:5000/api
```
