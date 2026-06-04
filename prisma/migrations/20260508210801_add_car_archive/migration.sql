-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Car" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "mileage" INTEGER,
    "vin" TEXT,
    "photoFileId" TEXT,
    "auction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BOUGHT',
    "buyPrice" REAL NOT NULL DEFAULT 0,
    "plannedSellPrice" REAL NOT NULL DEFAULT 0,
    "sellPrice" REAL,
    "soldAt" DATETIME,
    "boughtAt" DATETIME,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Car_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Car" ("auction", "boughtAt", "brand", "buyPrice", "createdAt", "id", "mileage", "model", "photoFileId", "plannedSellPrice", "sellPrice", "soldAt", "status", "updatedAt", "userId", "vin", "year") SELECT "auction", "boughtAt", "brand", "buyPrice", "createdAt", "id", "mileage", "model", "photoFileId", "plannedSellPrice", "sellPrice", "soldAt", "status", "updatedAt", "userId", "vin", "year" FROM "Car";
DROP TABLE "Car";
ALTER TABLE "new_Car" RENAME TO "Car";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
