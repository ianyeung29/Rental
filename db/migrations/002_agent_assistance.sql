ALTER TABLE rental_listing_private_details
  ADD COLUMN IF NOT EXISTS agent_service TEXT NOT NULL DEFAULT 'selfManaged',
  ADD COLUMN IF NOT EXISTS agent_fee_plan TEXT NOT NULL DEFAULT 'agentQuote',
  ADD COLUMN IF NOT EXISTS agent_fee_amount NUMERIC(12, 2);
