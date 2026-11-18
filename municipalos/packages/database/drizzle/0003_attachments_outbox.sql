CREATE TABLE "service_request_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded_by_kind" text NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_request_attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "service_request_attachments_kind_check" CHECK ("service_request_attachments"."kind" in ('report','completion')),
	CONSTRAINT "service_request_attachments_uploader_check" CHECK ("service_request_attachments"."uploaded_by_kind" in ('resident','staff'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_request_fk" FOREIGN KEY ("municipality_id","request_id") REFERENCES "public"."service_requests"("municipality_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_attachments_request_idx" ON "service_request_attachments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_outbox_idx" ON "notifications" USING btree ("status","next_attempt_at") WHERE "notifications"."channel" = 'email' and "notifications"."status" = 'queued';