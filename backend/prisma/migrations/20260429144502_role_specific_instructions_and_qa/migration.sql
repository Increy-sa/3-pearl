/*
  Warnings:

  - You are about to drop the column `adminInstructions` on the `Ticket` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL DEFAULT 'INTAKE',
    "stageEnteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSlaBreached" BOOLEAN NOT NULL DEFAULT false,
    "checklists" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "amPasswordVisibility" BOOLEAN NOT NULL DEFAULT false,
    "staffAcceptedAt" DATETIME,
    "staffNotes" TEXT,
    "assetsUrl" TEXT,
    "customSlaHours" INTEGER,
    "amInstructions" TEXT,
    "designerInstructions" TEXT,
    "developerInstructions" TEXT,
    "qaInstructions" TEXT,
    "clientId" TEXT NOT NULL,
    "accountManagerId" TEXT,
    "designerId" TEXT,
    "developerId" TEXT,
    "qaId" TEXT,
    "customerId" TEXT,
    CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_qaId_fkey" FOREIGN KEY ("qaId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("accountManagerId", "amPasswordVisibility", "assetsUrl", "checklists", "clientId", "createdAt", "customSlaHours", "customerId", "designerId", "developerId", "id", "isSlaBreached", "staffAcceptedAt", "staffNotes", "stage", "stageEnteredAt", "updatedAt") SELECT "accountManagerId", "amPasswordVisibility", "assetsUrl", "checklists", "clientId", "createdAt", "customSlaHours", "customerId", "designerId", "developerId", "id", "isSlaBreached", "staffAcceptedAt", "staffNotes", "stage", "stageEnteredAt", "updatedAt" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
