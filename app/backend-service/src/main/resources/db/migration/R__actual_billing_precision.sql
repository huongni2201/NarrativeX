-- Repeatable, idempotent follow-up to V5 for deployments where V5 may already be recorded.
-- Keep the durable usage ledger at the same precision as provider/quota actual_cost.

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
