-- AlterTable
ALTER TABLE "application_definitions" ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "app_versions" (
    "id" TEXT NOT NULL,
    "application_definition_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "form_schema" JSONB,
    "flow_nodes" JSONB,
    "flow_edges" JSONB,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by" TEXT,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_application_definition_id_version_key" ON "app_versions"("application_definition_id", "version");

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_application_definition_id_fkey" FOREIGN KEY ("application_definition_id") REFERENCES "application_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
