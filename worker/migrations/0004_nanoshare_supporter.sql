-- NanoShare supporter (99 THB once): unlimited sending. Set by the Stripe webhook or by an admin.
ALTER TABLE users ADD COLUMN nanoshare_supporter INTEGER NOT NULL DEFAULT 0;
