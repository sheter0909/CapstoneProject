-- ============================================================
-- Migration: add_purok_model
-- Creates the Purok table, normalises all existing free-text
-- purok strings, and links Household / GarbageCollector rows
-- to their Purok by FK.
--
-- REPORTING: any purok string that does NOT match one of the
-- known canonical names (Purok 1, Purok 2, Purok Calan 1,
-- Purok Calan 2, Purok Calan Proper) will produce a NOTICE so
-- you can correct them manually.  They are still migrated so
-- the DB stays consistent, but the notice tells you which
-- household/collector IDs are affected.
-- ============================================================

-- 1. Create the Purok table
CREATE TABLE "Purok" (
    "id"            TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "collectionDay" TEXT,
    "isActive"      BOOLEAN      NOT NULL DEFAULT TRUE,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purok_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Purok_name_key" ON "Purok"("name");

-- 2. Add purokId FK columns (nullable — filled in step 4)
ALTER TABLE "Household"        ADD COLUMN "purokId" TEXT;
ALTER TABLE "GarbageCollector" ADD COLUMN "purokId" TEXT;

-- 3. Add the new Notification columns (targetPurok was never deployed before; add it now)
ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "targetPurok"   TEXT,
    ADD COLUMN               "targetPurokId" TEXT;

-- 3b. Re-create the missing index for targetPurok (it was declared in schema but may not exist)
CREATE INDEX IF NOT EXISTS "Notification_targetPurok_idx" ON "Notification"("targetPurok");

-- 4. Insert one Purok row for each distinct (normalised) value that
--    appears in Household.purok or GarbageCollector.assignedArea.
--    "Normalise" = trim + collapse whitespace + title-case each word.
DO $$
DECLARE
    raw       TEXT;
    norm      TEXT;
    known     TEXT[] := ARRAY[
                  'Purok 1',
                  'Purok 2',
                  'Purok Calan 1',
                  'Purok Calan 2',
                  'Purok Calan Proper'
              ];
    hh_ids    TEXT;
    col_ids   TEXT;
BEGIN
    -- Collect all distinct raw values from both tables
    FOR raw IN
        SELECT DISTINCT TRIM(REGEXP_REPLACE(purok, '\s+', ' ', 'g'))
        FROM "Household"
        WHERE TRIM(purok) <> ''
        UNION
        SELECT DISTINCT TRIM(REGEXP_REPLACE("assignedArea", '\s+', ' ', 'g'))
        FROM "GarbageCollector"
        WHERE TRIM("assignedArea") <> ''
    LOOP
        -- Title-case: lower everything, then upper-case first letter of each word
        SELECT STRING_AGG(
            UPPER(SUBSTRING(word, 1, 1)) || LOWER(SUBSTRING(word, 2)),
            ' '
        )
        INTO norm
        FROM UNNEST(STRING_TO_ARRAY(LOWER(raw), ' ')) AS word
        WHERE word <> '';

        -- Report if the value is not among the known canonical puroks
        IF NOT (norm = ANY(known)) THEN
            SELECT STRING_AGG(hh."householdId", ', ')
            INTO hh_ids
            FROM "Household" hh
            WHERE TRIM(REGEXP_REPLACE(hh.purok, '\s+', ' ', 'g')) ILIKE raw;

            SELECT STRING_AGG(gc."collectorId", ', ')
            INTO col_ids
            FROM "GarbageCollector" gc
            WHERE TRIM(REGEXP_REPLACE(gc."assignedArea", '\s+', ' ', 'g')) ILIKE raw;

            RAISE NOTICE
                'UNKNOWN PUROK VALUE "%". Affected households: [%]. Affected collectors: [%]. Please verify and rename or merge this purok manually.',
                norm,
                COALESCE(hh_ids, 'none'),
                COALESCE(col_ids, 'none');
        END IF;

        -- Upsert so re-running the migration is idempotent
        INSERT INTO "Purok" ("id", "name", "updatedAt")
        VALUES (gen_random_uuid()::TEXT, norm, CURRENT_TIMESTAMP)
        ON CONFLICT ("name") DO NOTHING;
    END LOOP;
END;
$$;

-- 5. Link Household rows to their Purok
UPDATE "Household" h
SET "purokId" = p."id"
FROM "Purok" p
WHERE p."name" = (
    SELECT STRING_AGG(
        UPPER(SUBSTRING(word, 1, 1)) || LOWER(SUBSTRING(word, 2)),
        ' '
    )
    FROM UNNEST(
        STRING_TO_ARRAY(
            LOWER(TRIM(REGEXP_REPLACE(h.purok, '\s+', ' ', 'g'))),
            ' '
        )
    ) AS word
    WHERE word <> ''
);

-- 6. Link GarbageCollector rows to their Purok
UPDATE "GarbageCollector" gc
SET "purokId" = p."id"
FROM "Purok" p
WHERE p."name" = (
    SELECT STRING_AGG(
        UPPER(SUBSTRING(word, 1, 1)) || LOWER(SUBSTRING(word, 2)),
        ' '
    )
    FROM UNNEST(
        STRING_TO_ARRAY(
            LOWER(TRIM(REGEXP_REPLACE(gc."assignedArea", '\s+', ' ', 'g'))),
            ' '
        )
    ) AS word
    WHERE word <> ''
);

-- 7. Create indexes
CREATE INDEX "Household_purokId_idx"          ON "Household"("purokId");
CREATE INDEX "GarbageCollector_purokId_idx"   ON "GarbageCollector"("purokId");
CREATE INDEX "Notification_targetPurokId_idx" ON "Notification"("targetPurokId");

-- 8. Add FK constraints
ALTER TABLE "Household"
    ADD CONSTRAINT "Household_purokId_fkey"
    FOREIGN KEY ("purokId") REFERENCES "Purok"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GarbageCollector"
    ADD CONSTRAINT "GarbageCollector_purokId_fkey"
    FOREIGN KEY ("purokId") REFERENCES "Purok"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_targetPurokId_fkey"
    FOREIGN KEY ("targetPurokId") REFERENCES "Purok"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
