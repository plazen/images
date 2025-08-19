-- SQL commands to fix permission issues
-- Run these in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Grant usage on the public schema to the service role
GRANT USAGE ON SCHEMA public TO service_role;

-- 2. Grant all privileges on the public schema to the service role
GRANT ALL ON SCHEMA public TO service_role;

-- 3. Grant all privileges on all tables in public schema to service role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- 4. Grant all privileges on all sequences in public schema to service role
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Grant all privileges on all functions in public schema to service role
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 6. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- 7. Specifically for your tables (if they exist):
-- Replace 'UserSettings' and 'tasks' with your actual table names if different
GRANT ALL PRIVILEGES ON TABLE "UserSettings" TO service_role;
GRANT ALL PRIVILEGES ON TABLE "tasks" TO service_role;

-- 8. Check current permissions (for debugging)
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public';

-- 9. Check table privileges for service_role
SELECT 
    table_schema,
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges
WHERE grantee = 'service_role' AND table_schema = 'public';

-- 10. Check schema privileges for service_role (using PostgreSQL system catalogs)
SELECT 
    n.nspname AS schema_name,
    CASE 
        WHEN has_schema_privilege('service_role', n.nspname, 'USAGE') THEN 'USAGE' 
        ELSE 'NO USAGE' 
    END AS usage_privilege,
    CASE 
        WHEN has_schema_privilege('service_role', n.nspname, 'CREATE') THEN 'CREATE' 
        ELSE 'NO CREATE' 
    END AS create_privilege
FROM pg_namespace n
WHERE n.nspname = 'public';

-- 11. Alternative way to check table permissions
SELECT 
    t.table_name,
    t.table_type,
    CASE 
        WHEN has_table_privilege('service_role', t.table_name, 'SELECT') THEN 'YES' 
        ELSE 'NO' 
    END AS can_select,
    CASE 
        WHEN has_table_privilege('service_role', t.table_name, 'INSERT') THEN 'YES' 
        ELSE 'NO' 
    END AS can_insert,
    CASE 
        WHEN has_table_privilege('service_role', t.table_name, 'UPDATE') THEN 'YES' 
        ELSE 'NO' 
    END AS can_update,
    CASE 
        WHEN has_table_privilege('service_role', t.table_name, 'DELETE') THEN 'YES' 
        ELSE 'NO' 
    END AS can_delete
FROM information_schema.tables t
WHERE t.table_schema = 'public';
