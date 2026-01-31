-- CreateTable
CREATE TABLE "master_data_items" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "master_data_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_data_items_connector_id_idx" ON "master_data_items"("connector_id");

-- AddForeignKey
ALTER TABLE "master_data_items" ADD CONSTRAINT "master_data_items_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "master_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
