-- Tenant isolation enforced by PostgreSQL, independent of application code.
--
-- The API connects as `municipalos_app`, which is not a superuser, does not own these tables
-- and has no BYPASSRLS attribute, so every statement it runs is filtered by these policies.
-- `withTenant()` sets app.tenant_id / app.user_id per transaction (SET LOCAL semantics).
-- With no tenant set, tenant tables appear empty and reject writes.

CREATE FUNCTION app_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'municipality_settings', 'module_entitlements', 'departments', 'roles', 'role_permissions',
    'staff_memberships', 'announcements', 'service_request_categories', 'service_requests',
    'service_request_events', 'notifications'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE: the table owner (migration role) is subject to the policies too.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (municipality_id = app_current_tenant()) WITH CHECK (municipality_id = app_current_tenant())',
      t);
  END LOOP;
END $$;
--> statement-breakpoint

-- A signed-in user may see their own memberships across municipalities (to pick where to work).
CREATE POLICY own_membership ON staff_memberships FOR SELECT
  USING (user_id = app_current_user());
--> statement-breakpoint

-- Audit events: tenants read only their own; platform-level events (NULL tenant) are write-only
-- for the runtime role.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_read ON audit_events FOR SELECT
  USING (municipality_id = app_current_tenant());
--> statement-breakpoint
CREATE POLICY audit_write ON audit_events FOR INSERT
  WITH CHECK (municipality_id IS NULL OR municipality_id = app_current_tenant());
--> statement-breakpoint

-- Least-privilege grants for the runtime role. Tables whose management UI does not exist yet
-- are read-only; widen these in the migration that ships the feature.
GRANT USAGE ON SCHEMA public TO municipalos_app;
--> statement-breakpoint
GRANT SELECT ON municipalities, municipality_domains, municipality_settings, module_entitlements,
  users, departments, roles, role_permissions, staff_memberships, announcements,
  service_request_categories TO municipalos_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON sessions, service_requests, notifications TO municipalos_app;
--> statement-breakpoint
-- Append-only: no UPDATE, DELETE or TRUNCATE.
GRANT SELECT, INSERT ON service_request_events, audit_events TO municipalos_app;
