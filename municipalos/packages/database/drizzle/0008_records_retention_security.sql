-- Records management: tenant isolation, least-privilege grants, and a database-level guarantee
-- that a record under legal hold cannot be dispositioned whatever the application does.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['retention_policies', 'legal_holds'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (municipality_id = app_current_tenant()) WITH CHECK (municipality_id = app_current_tenant())',
      t);
  END LOOP;
END $$;
--> statement-breakpoint
GRANT SELECT, INSERT ON retention_policies TO municipalos_app;
--> statement-breakpoint
GRANT UPDATE (retention_days, authority, updated_by_user_id, updated_at) ON retention_policies TO municipalos_app;
--> statement-breakpoint
-- Holds can be placed and released, never edited or removed.
GRANT SELECT, INSERT ON legal_holds TO municipalos_app;
--> statement-breakpoint
GRANT UPDATE (released_by_user_id, released_at, release_note) ON legal_holds TO municipalos_app;
--> statement-breakpoint

CREATE FUNCTION enforce_service_request_disposition() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dispositioned_at IS DISTINCT FROM OLD.dispositioned_at THEN
    IF OLD.dispositioned_at IS NOT NULL THEN
      RAISE EXCEPTION 'disposition of a record cannot be changed or undone'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status <> 'closed' THEN
      RAISE EXCEPTION 'only closed records can be dispositioned'
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM legal_holds h
      WHERE h.municipality_id = NEW.municipality_id
        AND h.record_type = 'service_request'
        AND h.record_id = NEW.id
        AND h.released_at IS NULL
    ) THEN
      RAISE EXCEPTION 'record is under legal hold and cannot be dispositioned'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER service_requests_disposition_guard
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_service_request_disposition();
--> statement-breakpoint
-- A hold must point at a record of the same municipality.
CREATE FUNCTION enforce_legal_hold_target() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.record_type = 'service_request' AND NOT EXISTS (
    SELECT 1 FROM service_requests r WHERE r.id = NEW.record_id AND r.municipality_id = NEW.municipality_id
  ) THEN
    RAISE EXCEPTION 'legal hold target does not exist in this municipality'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER legal_holds_target_guard
  BEFORE INSERT ON legal_holds
  FOR EACH ROW EXECUTE FUNCTION enforce_legal_hold_target();
