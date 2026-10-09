-- ─────────────────────────────────────────────────────────────────────────────
-- Ledger integrity rules
--
-- Defence in depth: the application already enforces all of these, but the
-- database refuses to store data that would break them even if a bug, a
-- manual query or a future service bypasses the application layer.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Users ────────────────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD CONSTRAINT "users_username_format"
    CHECK ("username" ~ '^[a-z0-9_]{3,20}$'),
  ADD CONSTRAINT "users_email_lowercase"
    CHECK ("email" = lower("email")),
  ADD CONSTRAINT "users_phone_kenyan_e164"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+254[17][0-9]{8}$'),
  ADD CONSTRAINT "users_counters_non_negative"
    CHECK ("failed_login_count" >= 0 AND "failed_pin_count" >= 0 AND "token_version" >= 0),
  -- SYSTEM can never sign in; ADMIN signs in but never moves money (no PIN);
  -- USER and BUSINESS need a password, a PIN and a phone number.
  ADD CONSTRAINT "users_credentials_by_role" CHECK (
       ("role" = 'SYSTEM'                 AND "password_hash" IS NULL     AND "pin_hash" IS NULL)
    OR ("role" = 'ADMIN'                  AND "password_hash" IS NOT NULL AND "pin_hash" IS NULL)
    OR ("role" IN ('USER', 'BUSINESS')    AND "password_hash" IS NOT NULL AND "pin_hash" IS NOT NULL
                                          AND "phone" IS NOT NULL)
  );

-- ── Wallets ──────────────────────────────────────────────────────────────────

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_currency_kes" CHECK ("currency" = 'KES'),
  -- Only the treasury (the issuer of simulated money) may go negative.
  ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("type" = 'TREASURY' OR "balance" >= 0);

CREATE UNIQUE INDEX "wallets_single_treasury" ON "wallets" ("type") WHERE "type" = 'TREASURY';

-- ── Transactions & ledger ────────────────────────────────────────────────────

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "transactions_distinct_wallets" CHECK ("from_wallet_id" <> "to_wallet_id"),
  ADD CONSTRAINT "transactions_currency_kes" CHECK ("currency" = 'KES'),
  -- TXN- followed by 10 Crockford base32 characters.
  ADD CONSTRAINT "transactions_reference_format"
    CHECK ("reference" ~ '^TXN-[0-9A-HJKMNP-TV-Z]{10}$'),
  ADD CONSTRAINT "transactions_completed_has_timestamp"
    CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL);

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount" > 0);

-- ── Requests, splits, QR, contacts, OTP, idempotency ─────────────────────────

ALTER TABLE "payment_requests"
  ADD CONSTRAINT "payment_requests_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_requests_not_self" CHECK ("requester_id" <> "payer_id"),
  ADD CONSTRAINT "payment_requests_currency_kes" CHECK ("currency" = 'KES');

ALTER TABLE "bill_splits"
  ADD CONSTRAINT "bill_splits_total_positive" CHECK ("total_amount" > 0),
  ADD CONSTRAINT "bill_splits_currency_kes" CHECK ("currency" = 'KES');

ALTER TABLE "bill_participants"
  ADD CONSTRAINT "bill_participants_owed_positive" CHECK ("amount_owed" > 0),
  ADD CONSTRAINT "bill_participants_paid_in_range"
    CHECK ("amount_paid" >= 0 AND "amount_paid" <= "amount_owed");

ALTER TABLE "qr_codes"
  ADD CONSTRAINT "qr_codes_code_format" CHECK ("code" ~ '^[A-Za-z0-9_-]{16,32}$'),
  ADD CONSTRAINT "qr_codes_amount_positive" CHECK ("amount" IS NULL OR "amount" > 0),
  ADD CONSTRAINT "qr_codes_static_has_no_amount" CHECK ("type" = 'DYNAMIC' OR "amount" IS NULL),
  ADD CONSTRAINT "qr_codes_scan_count_non_negative" CHECK ("scan_count" >= 0);

-- Each account has exactly one active static (profile) QR at a time.
CREATE UNIQUE INDEX "qr_codes_one_active_static_per_user"
  ON "qr_codes" ("user_id") WHERE "type" = 'STATIC' AND "is_active";

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_not_self" CHECK ("owner_id" <> "contact_id");

ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_attempts_in_range"
    CHECK ("attempts" >= 0 AND "attempts" <= "max_attempts");

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_response_code_range"
    CHECK ("response_code" IS NULL OR "response_code" BETWEEN 100 AND 599);

-- ── Append-only tables ───────────────────────────────────────────────────────

CREATE FUNCTION "reject_append_only_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % on "%" is not allowed', TG_OP, TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

-- ── Transactions: financial fields immutable, status moves forward only ─────

CREATE FUNCTION "guard_transaction_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: transactions cannot be deleted (reference %)', OLD."reference";
  END IF;

  IF (NEW."id", NEW."reference", NEW."type", NEW."amount", NEW."currency",
      NEW."from_wallet_id", NEW."to_wallet_id", NEW."initiator_id", NEW."payment_request_id",
      NEW."bill_split_id", NEW."qr_code_id", NEW."reversal_of_id", NEW."created_at")
     IS DISTINCT FROM
     (OLD."id", OLD."reference", OLD."type", OLD."amount", OLD."currency",
      OLD."from_wallet_id", OLD."to_wallet_id", OLD."initiator_id", OLD."payment_request_id",
      OLD."bill_split_id", OLD."qr_code_id", OLD."reversal_of_id", OLD."created_at") THEN
    RAISE EXCEPTION 'IMMUTABLE: financial fields of transaction % cannot change', OLD."reference";
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
       (OLD."status" = 'PENDING'   AND NEW."status" IN ('COMPLETED', 'FAILED'))
    OR (OLD."status" = 'COMPLETED' AND NEW."status" = 'REVERSED')
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS: transaction % cannot move from % to %',
      OLD."reference", OLD."status", NEW."status";
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "transactions_guard"
  BEFORE UPDATE OR DELETE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION "guard_transaction_change"();

-- ── Wallets: identity immutable, never deleted ───────────────────────────────

CREATE FUNCTION "guard_wallet_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: wallets cannot be deleted (wallet %)', OLD."id";
  END IF;
  IF (NEW."id", NEW."user_id", NEW."type", NEW."currency", NEW."created_at")
     IS DISTINCT FROM (OLD."id", OLD."user_id", OLD."type", OLD."currency", OLD."created_at") THEN
    RAISE EXCEPTION 'IMMUTABLE: wallet % owner, type and currency cannot change', OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "wallets_guard"
  BEFORE UPDATE OR DELETE ON "wallets"
  FOR EACH ROW EXECUTE FUNCTION "guard_wallet_change"();

-- ── Commit-time ledger invariants (deferred constraint triggers) ─────────────
--
-- Checked when the database transaction COMMITS, so a service can insert the
-- transaction, its entries and the balance updates in any order — but cannot
-- commit an inconsistent state.

-- 1. A wallet's cached balance always equals the sum of its ledger entries.
--    (O(entries per wallet); fine for the demo. At scale, compare against the
--    newest entry's balance_after instead.)
CREATE FUNCTION "assert_wallet_matches_ledger"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_balance numeric(18, 2);
  ledger_balance  numeric(18, 2);
BEGIN
  SELECT "balance" INTO current_balance FROM "wallets" WHERE "id" = NEW."id";
  SELECT COALESCE(SUM(CASE WHEN "direction" = 'CREDIT' THEN "amount" ELSE -"amount" END), 0)
    INTO ledger_balance
    FROM "ledger_entries" WHERE "wallet_id" = NEW."id";

  IF current_balance IS DISTINCT FROM ledger_balance THEN
    RAISE EXCEPTION 'LEDGER_MISMATCH: wallet % balance % does not equal ledger sum %',
      NEW."id", current_balance, ledger_balance;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "wallets_balance_matches_ledger"
  AFTER INSERT OR UPDATE OF "balance" ON "wallets"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "assert_wallet_matches_ledger"();

-- 2. Every COMPLETED transaction is exactly one debit of its source wallet and
--    one credit of its destination wallet, each equal to the transaction amount.
CREATE FUNCTION "assert_transaction_balanced"(txn_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  txn       "transactions"%ROWTYPE;
  debits    integer;
  credits   integer;
  mismatched integer;
BEGIN
  SELECT * INTO txn FROM "transactions" WHERE "id" = txn_id;
  IF NOT FOUND OR txn."status" NOT IN ('COMPLETED', 'REVERSED') THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE "direction" = 'DEBIT'  AND "wallet_id" = txn."from_wallet_id"),
    COUNT(*) FILTER (WHERE "direction" = 'CREDIT' AND "wallet_id" = txn."to_wallet_id"),
    COUNT(*) FILTER (WHERE "amount" <> txn."amount"
                        OR NOT ("direction" = 'DEBIT'  AND "wallet_id" = txn."from_wallet_id"
                             OR "direction" = 'CREDIT' AND "wallet_id" = txn."to_wallet_id"))
  INTO debits, credits, mismatched
  FROM "ledger_entries" WHERE "transaction_id" = txn_id;

  IF debits <> 1 OR credits <> 1 OR mismatched <> 0 THEN
    RAISE EXCEPTION 'UNBALANCED_TRANSACTION: % must have one debit and one credit of %',
      txn."reference", txn."amount";
  END IF;
END;
$$;

CREATE FUNCTION "assert_transaction_balanced_from_txn"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "assert_transaction_balanced"(NEW."id");
  RETURN NULL;
END;
$$;

CREATE FUNCTION "assert_transaction_balanced_from_entry"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "assert_transaction_balanced"(NEW."transaction_id");
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "transactions_balanced"
  AFTER INSERT OR UPDATE OF "status" ON "transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "assert_transaction_balanced_from_txn"();

CREATE CONSTRAINT TRIGGER "ledger_entries_balanced"
  AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "assert_transaction_balanced_from_entry"();
