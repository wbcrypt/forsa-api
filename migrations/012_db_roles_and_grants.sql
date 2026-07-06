-- Migration 012: least-privilege DB roles + permanent grants (Phase 3 finding, business decision 2026-07-06)
--
-- Two compounding gaps found during Phase 3 browser E2E testing:
--
-- 1. Nothing anywhere in this repo (migrations, docker-compose, scripts)
--    ever creates the forsa_app/forsa_readonly roles the application
--    itself requires (DB_APP_USER/DB_READONLY_USER are REQUIRED config —
--    see src/config/configuration.ts). A genuinely fresh deployment
--    following only docker-compose + migrate + seed would fail to even
--    authenticate as forsa_app. In every environment this has been
--    tested in so far, these roles existed only because someone created
--    them by hand, out of band, with no record of having done so.
--
-- 2. Five Phase 2 tables (membership_requests, membership_status_history,
--    password_setup_tokens, digital_student_passes, fraud_records) were
--    created without a corresponding grant to forsa_app — submitting a
--    Membership Request (the product's own entry point) failed with
--    "permission denied for table membership_requests" against the
--    real least-privilege runtime role, even though it worked fine
--    against the migration superuser used to develop against.
--
-- This migration is idempotent (safe to re-run) and forward-looking:
-- ALTER DEFAULT PRIVILEGES ensures every table any future migration
-- creates is automatically granted to both roles from that point on,
-- so this specific failure class cannot recur — no migration should
-- ever need to touch a GRANT again.
--
-- Passwords are substituted by scripts/migrate.ts from the same
-- DB_APP_PASSWORD/DB_READONLY_PASSWORD env vars the application itself
-- already requires — never hardcoded in this git-tracked file.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_app') THEN
    CREATE ROLE forsa_app LOGIN PASSWORD '__DB_APP_PASSWORD__';
  ELSE
    ALTER ROLE forsa_app WITH PASSWORD '__DB_APP_PASSWORD__';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'forsa_readonly') THEN
    CREATE ROLE forsa_readonly LOGIN PASSWORD '__DB_READONLY_PASSWORD__';
  ELSE
    ALTER ROLE forsa_readonly WITH PASSWORD '__DB_READONLY_PASSWORD__';
  END IF;
END
$$;

-- Grant on every table that exists right now (covers the 5 specific
-- tables found missing, and closes the same gap for anything else that
-- may have slipped through unnoticed).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO forsa_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO forsa_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO forsa_app;
GRANT USAGE ON SCHEMA public TO forsa_app, forsa_readonly;

-- Forward-looking: every table any future migration creates (run by
-- whichever role scripts/migrate.ts connects as) is automatically
-- granted from the moment it's created — this is the actual permanent
-- fix, not just a one-time backfill.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO forsa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO forsa_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO forsa_app;

COMMENT ON ROLE forsa_app IS 'Least-privilege application runtime role. Password managed via DB_APP_PASSWORD; do not connect to this role from anything but the running application.';
COMMENT ON ROLE forsa_readonly IS 'Read-only reporting/analytics role. Password managed via DB_READONLY_PASSWORD.';
