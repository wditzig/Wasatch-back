-- Row-level security and least-privilege grants for the website CMS.

ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE website_pages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON website_pages
  USING (municipality_id = app_current_tenant())
  WITH CHECK (municipality_id = app_current_tenant());
--> statement-breakpoint
ALTER TABLE content_revisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE content_revisions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON content_revisions
  USING (municipality_id = app_current_tenant())
  WITH CHECK (municipality_id = app_current_tenant());
--> statement-breakpoint
-- Pages and revisions are created and edited, never deleted: history is kept.
GRANT SELECT, INSERT, UPDATE ON website_pages, content_revisions TO municipalos_app;
--> statement-breakpoint
-- Announcements become manageable by staff (they were read-only until now). Still no DELETE:
-- an announcement is withdrawn by expiring it.
GRANT INSERT, UPDATE ON announcements TO municipalos_app;
