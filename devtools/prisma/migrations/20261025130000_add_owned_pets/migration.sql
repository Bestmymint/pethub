CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT NOT NULL DEFAULT '',
    "sex" TEXT NOT NULL DEFAULT 'unknown',
    "birthday" DATE,
    "weight" DOUBLE PRECISION,
    "color" TEXT NOT NULL DEFAULT 'peach',
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pets_species_check" CHECK ("species" IN ('dog', 'cat', 'other')),
    CONSTRAINT "pets_sex_check" CHECK ("sex" IN ('male', 'female', 'unknown')),
    CONSTRAINT "pets_color_check" CHECK ("color" IN ('peach', 'sage', 'lavender')),
    CONSTRAINT "pets_weight_check" CHECK ("weight" IS NULL OR ("weight" > 0 AND "weight" <= 200))
);

CREATE INDEX "pets_ownerId_archivedAt_createdAt_idx" ON "pets"("ownerId", "archivedAt", "createdAt");

ALTER TABLE "pets" ADD CONSTRAINT "pets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pet_health_records" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_health_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pet_health_records_category_check" CHECK ("category" IN ('checkup', 'vaccine', 'weight', 'note')),
    CONSTRAINT "pet_health_records_weight_check" CHECK ("category" <> 'weight' OR ("value" IS NOT NULL AND "value" > 0 AND "value" <= 200))
);
CREATE INDEX "pet_health_records_petId_date_createdAt_idx" ON "pet_health_records"("petId", "date", "createdAt");
ALTER TABLE "pet_health_records" ADD CONSTRAINT "pet_health_records_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pet_care_logs" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_care_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pet_care_logs_task_check" CHECK ("task" IN ('breakfast', 'play', 'dinner'))
);
CREATE UNIQUE INDEX "pet_care_logs_petId_task_date_key" ON "pet_care_logs"("petId", "task", "date");
ALTER TABLE "pet_care_logs" ADD CONSTRAINT "pet_care_logs_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
