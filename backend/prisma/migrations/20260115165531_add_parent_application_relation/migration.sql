-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
