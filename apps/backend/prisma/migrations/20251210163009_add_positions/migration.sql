-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "Network" AS ENUM ('MAINNET', 'DEVNET');

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "network" "Network" NOT NULL DEFAULT 'MAINNET',
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "collateralToken" TEXT NOT NULL,
    "collateralMint" TEXT NOT NULL,
    "collateralAmount" DOUBLE PRECISION NOT NULL,
    "borrowToken" TEXT NOT NULL,
    "borrowMint" TEXT NOT NULL,
    "borrowAmount" DOUBLE PRECISION NOT NULL,
    "leverage" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "liquidationPrice" DOUBLE PRECISION NOT NULL,
    "openHealthFactor" DOUBLE PRECISION NOT NULL,
    "currentHealthFactor" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unrealizedPnl" DOUBLE PRECISION,
    "openTxSignature" TEXT,
    "closeTxSignature" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionHistory" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "healthFactor" DOUBLE PRECISION NOT NULL,
    "collateralValue" DOUBLE PRECISION NOT NULL,
    "borrowValue" DOUBLE PRECISION NOT NULL,
    "liquidationPrice" DOUBLE PRECISION NOT NULL,
    "oraclePrice" DOUBLE PRECISION NOT NULL,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_walletAddress_idx" ON "Position"("walletAddress");

-- CreateIndex
CREATE INDEX "Position_walletAddress_status_idx" ON "Position"("walletAddress", "status");

-- CreateIndex
CREATE INDEX "Position_protocol_idx" ON "Position"("protocol");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "Position"("status");

-- CreateIndex
CREATE INDEX "Position_openedAt_idx" ON "Position"("openedAt");

-- CreateIndex
CREATE INDEX "PositionHistory_positionId_idx" ON "PositionHistory"("positionId");

-- CreateIndex
CREATE INDEX "PositionHistory_positionId_createdAt_idx" ON "PositionHistory"("positionId", "createdAt");

-- CreateIndex
CREATE INDEX "PositionHistory_createdAt_idx" ON "PositionHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "PositionHistory" ADD CONSTRAINT "PositionHistory_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
