-- Row-level security and least-privilege grants for request photos, plus the write grants
-- needed by the staff administration features (categories, settings, staff access).

ALTER TABLE service_request_attachments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE service_request_attachments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON service_request_attachments
  USING (municipality_id = app_current_tenant())
  WITH CHECK (municipality_id = app_current_tenant());
--> statement-breakpoint
-- Photos are evidence attached to a record: insert and read only.
GRANT SELECT, INSERT ON service_request_attachments TO municipalos_app;
--> statement-breakpoint
GRANT INSERT, UPDATE ON service_request_categories TO municipalos_app;
--> statement-breakpoint
GRANT UPDATE ON municipality_settings TO municipalos_app;
--> statement-breakpoint
-- Staff access changes: role, department, title and status only. Memberships cannot be moved
-- to another user or municipality, and cannot be created or deleted by the runtime role yet.
GRANT UPDATE (role_id, department_id, title, status, updated_at) ON staff_memberships TO municipalos_app;
