-- Preserve provider actual-cost precision in the durable usage ledger.
-- V5 stores provider/quota actual_cost at NUMERIC(19,9), while the pre-existing usage window
-- projection used NUMERIC(19,6). Align the ledger so settlement never rounds provider cost.

ALTER TABLE usage_windows
    ALTER COLUMN credits_used TYPE NUMERIC(19, 9)
    USING credits_used::NUMERIC(19, 9);

-- V5 backfilled unresolved historical reservations with an actual_cost of zero even though no
-- terminal provider billing was known. Restore the semantic distinction between "not reconciled"
-- and a known zero-cost terminal operation.
UPDATE quota_reservations
   SET actual_cost = NULL
 WHERE status = 'RESERVED'
   AND finalized_at IS NULL
   AND actual_cost = 0
   AND billing_currency IS NULL;
