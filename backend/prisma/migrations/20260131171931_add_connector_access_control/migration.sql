-- CreateTable
CREATE TABLE "_ConnectorAccess" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConnectorAccess_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ConnectorAccess_B_index" ON "_ConnectorAccess"("B");

-- AddForeignKey
ALTER TABLE "_ConnectorAccess" ADD CONSTRAINT "_ConnectorAccess_A_fkey" FOREIGN KEY ("A") REFERENCES "application_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConnectorAccess" ADD CONSTRAINT "_ConnectorAccess_B_fkey" FOREIGN KEY ("B") REFERENCES "master_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
