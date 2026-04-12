-- Auth now uses self-contained JWT cookies for access and refresh.
-- Runtime session persistence is no longer required.
DROP TABLE IF EXISTS "AuthSession";
