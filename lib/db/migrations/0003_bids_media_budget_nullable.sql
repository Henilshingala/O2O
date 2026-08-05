-- Migration: BUG 2 + BUG 3 schema changes
-- BUG 2: Add media columns to bids table
-- BUG 3: Make budget nullable (we stop accepting it from the form but keep the column)
-- Also make deliveryTime optional in bid_offers (BUG 1: we stop accepting it from API)

-- BUG 2: media columns on bids
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "media_images" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "media_videos" jsonb DEFAULT '[]'::jsonb;

-- BUG 3: make budget nullable with a default of 0
ALTER TABLE "bids" ALTER COLUMN "budget" DROP NOT NULL;
ALTER TABLE "bids" ALTER COLUMN "budget" SET DEFAULT 0;

-- BUG 1: make deliveryTime nullable so existing offers with no delivery time don't break
ALTER TABLE "bid_offers" ALTER COLUMN "delivery_time" DROP NOT NULL;
ALTER TABLE "bid_offers" ALTER COLUMN "delivery_time" SET DEFAULT '';
