-- CreateEnum
CREATE TYPE "CopilotStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "copilot_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "CopilotStatus" NOT NULL DEFAULT 'ACTIVE',
    "history" JSONB NOT NULL DEFAULT '[]',
    "context" JSONB NOT NULL DEFAULT '{}',
    "agent_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_sessions_pkey" PRIMARY KEY ("id")
);
