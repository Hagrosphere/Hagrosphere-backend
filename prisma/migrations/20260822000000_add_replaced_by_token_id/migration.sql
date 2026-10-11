-- Add replacedByTokenId to track token rotation chains
ALTER TABLE "refresh_tokens" ADD COLUMN "replacedByTokenId" TEXT;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replacedByTokenId_key" UNIQUE ("replacedByTokenId");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replacedByTokenId_fkey"
  FOREIGN KEY ("replacedByTokenId") REFERENCES "refresh_tokens"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "refresh_tokens_replacedByTokenId_idx" ON "refresh_tokens"("replacedByTokenId");
