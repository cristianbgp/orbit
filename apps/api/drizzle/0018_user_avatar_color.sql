ALTER TABLE "user" ADD COLUMN "avatar_color" text DEFAULT '#4657d9' NOT NULL;--> statement-breakpoint
WITH RECURSIVE "avatar_hash" ("id", "position", "hash_value") AS (
	SELECT "id", 1, 0::numeric
	FROM "user"
	UNION ALL
	SELECT
		"id",
		"position" + 1,
		mod(
			"hash_value" * 31 + ascii(substring("id" FROM "position" FOR 1)),
			4294967296
		)
	FROM "avatar_hash"
	WHERE "position" <= char_length("id")
), "final_avatar_hash" AS (
	SELECT "id", "hash_value"
	FROM "avatar_hash"
	WHERE "position" = char_length("id") + 1
)
UPDATE "user"
SET "avatar_color" = (ARRAY[
	'#4657d9', '#4057ed', '#07162f', '#11182b'
])[(mod("final_avatar_hash"."hash_value", 4) + 1)::integer]
FROM "final_avatar_hash"
WHERE "user"."id" = "final_avatar_hash"."id";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_color_hex_check" CHECK ("user"."avatar_color" ~ '^#[0-9a-f]{6}$');
