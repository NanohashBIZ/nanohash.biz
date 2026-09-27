-- Stripe Checkout orders. One row per Checkout Session; license_id is set once the key is issued,
-- so fulfilling the same session twice (return page + webhook) issues only one key.

CREATE TABLE orders (
  session_id TEXT PRIMARY KEY,    -- Stripe Checkout Session id (cs_...)
  user_id TEXT NOT NULL REFERENCES users (id),
  email TEXT NOT NULL,
  product TEXT NOT NULL,          -- tidyup | nanopdf
  term TEXT NOT NULL,             -- 1y | never
  display_name TEXT NOT NULL,     -- name to put in the key
  amount INTEGER NOT NULL,        -- smallest currency unit (satang)
  currency TEXT NOT NULL,
  livemode INTEGER NOT NULL,
  status TEXT NOT NULL,           -- open | paid | expired
  license_id INTEGER,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX orders_user ON orders (user_id, created_at);
