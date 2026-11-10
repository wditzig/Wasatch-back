CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid,
	"actor_kind" text NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"phone" text,
	"email" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_tenant_slug" UNIQUE("municipality_id","slug"),
	CONSTRAINT "departments_tenant_id" UNIQUE("municipality_id","id")
);
--> statement-breakpoint
CREATE TABLE "module_entitlements" (
	"municipality_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_entitlements_municipality_id_module_key_pk" PRIMARY KEY("municipality_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"timezone" text DEFAULT 'America/Denver' NOT NULL,
	"reference_prefix" text NOT NULL,
	"status" text DEFAULT 'onboarding' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipalities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "municipalities_status_check" CHECK ("municipalities"."status" in ('onboarding','active','suspended')),
	CONSTRAINT "municipalities_prefix_check" CHECK ("municipalities"."reference_prefix" ~ '^[A-Z]{2,4}$')
);
--> statement-breakpoint
CREATE TABLE "municipality_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"hostname" "citext" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipality_domains_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
CREATE TABLE "municipality_settings" (
	"municipality_id" uuid PRIMARY KEY NOT NULL,
	"branding" jsonb NOT NULL,
	"contact" jsonb NOT NULL,
	"allow_anonymous_requests" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"recipient_user_id" uuid,
	"recipient_email" text,
	"subject" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_channel_check" CHECK ("notifications"."channel" in ('in_app','email')),
	CONSTRAINT "notifications_recipient_check" CHECK (("notifications"."channel" = 'in_app' and "notifications"."recipient_user_id" is not null) or ("notifications"."channel" = 'email' and "notifications"."recipient_email" is not null))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"municipality_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_tenant_key" UNIQUE("municipality_id","key"),
	CONSTRAINT "roles_tenant_id" UNIQUE("municipality_id","id")
);
--> statement-breakpoint
CREATE TABLE "service_request_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_request_categories_tenant_slug" UNIQUE("municipality_id","slug"),
	CONSTRAINT "service_request_categories_tenant_id" UNIQUE("municipality_id","id")
);
--> statement-breakpoint
CREATE TABLE "service_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"type" text NOT NULL,
	"visibility" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"body" text,
	"actor_kind" text NOT NULL,
	"actor_user_id" uuid,
	"subject_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_request_events_visibility_check" CHECK ("service_request_events"."visibility" in ('public','internal')),
	CONSTRAINT "service_request_events_actor_check" CHECK ("service_request_events"."actor_kind" in ('resident','staff','system'))
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"category_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"description" text NOT NULL,
	"location_text" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"reporter_name" text,
	"reporter_email" text,
	"reporter_phone" text,
	"assigned_to_user_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "service_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "service_requests_tenant_id" UNIQUE("municipality_id","id"),
	CONSTRAINT "service_requests_status_check" CHECK ("service_requests"."status" in ('new','reviewed','assigned','in_progress','resolved','closed')),
	CONSTRAINT "service_requests_coordinates_check" CHECK (("service_requests"."latitude" is null) = ("service_requests"."longitude" is null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "staff_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"department_id" uuid,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_memberships_tenant_user" UNIQUE("municipality_id","user_id"),
	CONSTRAINT "staff_memberships_status_check" CHECK ("staff_memberships"."status" in ('active','suspended'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active','disabled'))
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_entitlements" ADD CONSTRAINT "module_entitlements_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality_domains" ADD CONSTRAINT "municipality_domains_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality_settings" ADD CONSTRAINT "municipality_settings_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_fk" FOREIGN KEY ("municipality_id","role_id") REFERENCES "public"."roles"("municipality_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_categories" ADD CONSTRAINT "service_request_categories_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_categories" ADD CONSTRAINT "service_request_categories_department_fk" FOREIGN KEY ("municipality_id","department_id") REFERENCES "public"."departments"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_events" ADD CONSTRAINT "service_request_events_request_fk" FOREIGN KEY ("municipality_id","request_id") REFERENCES "public"."service_requests"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_category_fk" FOREIGN KEY ("municipality_id","category_id") REFERENCES "public"."service_request_categories"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_department_fk" FOREIGN KEY ("municipality_id","department_id") REFERENCES "public"."departments"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_role_fk" FOREIGN KEY ("municipality_id","role_id") REFERENCES "public"."roles"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_department_fk" FOREIGN KEY ("municipality_id","department_id") REFERENCES "public"."departments"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_tenant_published_idx" ON "announcements" USING btree ("municipality_id","published_at");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_created_idx" ON "audit_events" USING btree ("municipality_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("municipality_id","recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "service_request_events_request_idx" ON "service_request_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_idempotency_idx" ON "service_requests" USING btree ("municipality_id","idempotency_key") WHERE "service_requests"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "service_requests_queue_idx" ON "service_requests" USING btree ("municipality_id","status","created_at");--> statement-breakpoint
CREATE INDEX "service_requests_department_idx" ON "service_requests" USING btree ("municipality_id","department_id","status");--> statement-breakpoint
CREATE INDEX "service_requests_assignee_idx" ON "service_requests" USING btree ("municipality_id","assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_memberships_user_idx" ON "staff_memberships" USING btree ("user_id");