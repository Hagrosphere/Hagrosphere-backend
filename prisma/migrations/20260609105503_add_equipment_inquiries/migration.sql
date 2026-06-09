-- CreateTable
CREATE TABLE "equipment_inquiries" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "currentLocation" TEXT NOT NULL,
    "farmSize" TEXT,
    "usageDuration" TEXT,
    "additionalDetails" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_inquiries_equipmentId_idx" ON "equipment_inquiries"("equipmentId");

-- CreateIndex
CREATE INDEX "equipment_inquiries_email_idx" ON "equipment_inquiries"("email");

-- CreateIndex
CREATE INDEX "equipment_inquiries_status_idx" ON "equipment_inquiries"("status");

-- CreateIndex
CREATE INDEX "equipment_inquiries_createdAt_idx" ON "equipment_inquiries"("createdAt");

-- AddForeignKey
ALTER TABLE "equipment_inquiries" ADD CONSTRAINT "equipment_inquiries_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
