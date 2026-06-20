-- Migration: logistics_bundles_and_thresholds
-- Adds LinenBundleTemplate, LinenBundleInstance, bundleInstanceId FK on LinenSet,
-- and parTarget/reorderThreshold on Consumable.

-- AlterTable: add optional bundleInstanceId FK on LinenSet
ALTER TABLE "LinenSet" ADD COLUMN "bundleInstanceId" TEXT;

-- AlterTable: add PAR + reorder threshold on Consumable
ALTER TABLE "Consumable" ADD COLUMN "parTarget" INTEGER;
ALTER TABLE "Consumable" ADD COLUMN "reorderThreshold" INTEGER;

-- CreateTable: host-defined kit definition
CREATE TABLE "LinenBundleTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parTarget" INTEGER NOT NULL DEFAULT 3,
    "components" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinenBundleTemplate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: one physical kit in circulation
CREATE TABLE "LinenBundleInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'STORED_CLEAN',
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinenBundleInstance_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LinenBundleInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LinenBundleTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LinenBundleInstance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
