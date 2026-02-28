CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"password" varchar(255),
	"metadata" jsonb,
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"guest_id" varchar(255),
	"original_name" varchar(255) NOT NULL,
	"operations_used" jsonb,
	"preview_s3_key" varchar(500) NOT NULL,
	"hd_s3_key" varchar(500) NOT NULL,
	"size_kb" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_unique_idx" ON "auth_accounts" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "user_id_index" ON "images" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guest_id_index" ON "images" USING btree ("guest_id");