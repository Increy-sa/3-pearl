-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ClientInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "nationalId" TEXT,
    "iban" TEXT,
    "businessName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "hasDocument" BOOLEAN NOT NULL DEFAULT false,
    "documentFileUrl" TEXT,
    "hasLegalDoc" BOOLEAN NOT NULL DEFAULT true,
    "nationalIdUrl" TEXT,
    "fullNameInId" TEXT,
    "absherPhone" TEXT
);

-- CreateTable
CREATE TABLE "AIProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "selectedColors" TEXT NOT NULL,
    "brandVoice" TEXT,
    "suggestedNames" TEXT NOT NULL,
    "businessName" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "referenceLogos" TEXT,
    "generatedLogoUrl" TEXT,
    "selectedName" TEXT,
    "ticketId" TEXT NOT NULL,
    CONSTRAINT "AIProposal_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoreDetails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sallaStoreUrl" TEXT,
    "domainName" TEXT,
    "storeEmail" TEXT,
    "storePasswordEncrypted" TEXT,
    "isProPurchased" BOOLEAN NOT NULL DEFAULT false,
    "paymentGatewayConfigured" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    CONSTRAINT "StoreDetails_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL DEFAULT 'INTAKE',
    "stageEnteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSlaBreached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountManagerId" TEXT,
    "designerId" TEXT,
    "developerId" TEXT,
    "customerId" TEXT,
    CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AIProposal_ticketId_key" ON "AIProposal"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDetails_ticketId_key" ON "StoreDetails"("ticketId");
