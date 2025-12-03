-- CreateEnum
CREATE TYPE "Protocol" AS ENUM ('DRIFT', 'MARGINFI', 'SOLEND');

-- CreateEnum
CREATE TYPE "RecommendedAction" AS ENUM ('PROTECT', 'MONITOR', 'SAFE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'SIMULATING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "MonitoredAccount" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "collateralValue" DOUBLE PRECISION NOT NULL,
    "borrowedValue" DOUBLE PRECISION NOT NULL,
    "leverage" DOUBLE PRECISION NOT NULL,
    "healthFactor" DOUBLE PRECISION NOT NULL,
    "maintenanceMarginRatio" DOUBLE PRECISION NOT NULL,
    "currentMarginRatio" DOUBLE PRECISION NOT NULL,
    "liquidationPrice" DOUBLE PRECISION NOT NULL,
    "oraclePrice" DOUBLE PRECISION NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "hvixValue" DOUBLE PRECISION NOT NULL,
    "cascadeProbability" DOUBLE PRECISION NOT NULL,
    "timeToLiquidation" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "cascadeProbability" DOUBLE PRECISION NOT NULL,
    "timeToLiquidation" DOUBLE PRECISION NOT NULL,
    "estimatedLosses" DOUBLE PRECISION NOT NULL,
    "recommendedAction" "RecommendedAction" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtectiveSwap" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fromToken" TEXT NOT NULL,
    "toToken" TEXT NOT NULL,
    "inputAmount" DOUBLE PRECISION NOT NULL,
    "outputAmount" DOUBLE PRECISION NOT NULL,
    "slippageBps" INTEGER NOT NULL,
    "usedShadowLane" BOOLEAN NOT NULL,
    "usedJitoBundle" BOOLEAN NOT NULL,
    "jitoTipLamports" INTEGER,
    "bundleId" TEXT,
    "standardSlippage" DOUBLE PRECISION,
    "actualSlippage" DOUBLE PRECISION,
    "mevSaved" DOUBLE PRECISION,
    "transactionSignature" TEXT,
    "status" "SwapStatus" NOT NULL,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtectiveSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pyth',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemStats" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalAccountsMonitored" INTEGER NOT NULL,
    "totalAlertsGenerated" INTEGER NOT NULL,
    "totalProtectiveSwaps" INTEGER NOT NULL,
    "totalMevSaved" DOUBLE PRECISION NOT NULL,
    "totalValueProtected" DOUBLE PRECISION NOT NULL,
    "avgRiskScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredAccount_walletAddress_key" ON "MonitoredAccount"("walletAddress");

-- CreateIndex
CREATE INDEX "MonitoredAccount_walletAddress_idx" ON "MonitoredAccount"("walletAddress");

-- CreateIndex
CREATE INDEX "MonitoredAccount_protocol_idx" ON "MonitoredAccount"("protocol");

-- CreateIndex
CREATE INDEX "MonitoredAccount_isActive_idx" ON "MonitoredAccount"("isActive");

-- CreateIndex
CREATE INDEX "AccountSnapshot_accountId_idx" ON "AccountSnapshot"("accountId");

-- CreateIndex
CREATE INDEX "AccountSnapshot_accountId_createdAt_idx" ON "AccountSnapshot"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountSnapshot_createdAt_idx" ON "AccountSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_accountId_idx" ON "Alert"("accountId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_accountId_status_idx" ON "Alert"("accountId", "status");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "ProtectiveSwap_accountId_idx" ON "ProtectiveSwap"("accountId");

-- CreateIndex
CREATE INDEX "ProtectiveSwap_status_idx" ON "ProtectiveSwap"("status");

-- CreateIndex
CREATE INDEX "ProtectiveSwap_accountId_createdAt_idx" ON "ProtectiveSwap"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ProtectiveSwap_createdAt_idx" ON "ProtectiveSwap"("createdAt");

-- CreateIndex
CREATE INDEX "PriceHistory_token_idx" ON "PriceHistory"("token");

-- CreateIndex
CREATE INDEX "PriceHistory_token_createdAt_idx" ON "PriceHistory"("token", "createdAt");

-- CreateIndex
CREATE INDEX "PriceHistory_createdAt_idx" ON "PriceHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemStats_date_key" ON "SystemStats"("date");

-- CreateIndex
CREATE INDEX "SystemStats_date_idx" ON "SystemStats"("date");

-- AddForeignKey
ALTER TABLE "AccountSnapshot" ADD CONSTRAINT "AccountSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MonitoredAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MonitoredAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtectiveSwap" ADD CONSTRAINT "ProtectiveSwap_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MonitoredAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
