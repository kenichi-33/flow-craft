-- AlterTable
ALTER TABLE "approval_histories" ADD COLUMN     "is_proxy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_actor_id" TEXT;
