-- Run with a PostgreSQL administrator on the dedicated Larynx ledger database.
-- This creates a separate, non-superuser login and grants only read access to
-- the three API tables. Set its password with the interactive psql \password
-- command; never put a password in this file or in the repository.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'larynx31_api_readonly') THEN
    CREATE ROLE larynx31_api_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

ALTER ROLE larynx31_api_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE larynx31_api_readonly SET default_transaction_read_only = on;
ALTER ROLE larynx31_api_readonly SET statement_timeout = '5s';
ALTER ROLE larynx31_api_readonly SET lock_timeout = '1s';

GRANT USAGE ON SCHEMA larynx31 TO larynx31_api_readonly;
GRANT SELECT ON TABLE larynx31.leads, larynx31.followups, larynx31.errors TO larynx31_api_readonly;

-- Then run interactively in psql: \password larynx31_api_readonly
