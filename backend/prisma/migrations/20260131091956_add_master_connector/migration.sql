-- CreateTable
CREATE TABLE "master_connectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "mapping" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_connectors_pkey" PRIMARY KEY ("id")
);
