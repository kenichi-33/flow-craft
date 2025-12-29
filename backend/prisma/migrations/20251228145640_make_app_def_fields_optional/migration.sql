-- DropForeignKey
ALTER TABLE "application_definitions" DROP CONSTRAINT "application_definitions_flow_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "application_definitions" DROP CONSTRAINT "application_definitions_form_definition_id_fkey";

-- AlterTable
ALTER TABLE "application_definitions" ALTER COLUMN "form_definition_id" DROP NOT NULL,
ALTER COLUMN "flow_definition_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "application_definitions" ADD CONSTRAINT "application_definitions_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_definitions" ADD CONSTRAINT "application_definitions_flow_definition_id_fkey" FOREIGN KEY ("flow_definition_id") REFERENCES "flow_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
