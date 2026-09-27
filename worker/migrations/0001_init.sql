-- Accounts, sessions, License Keys and support requests for nanohash.biz/account.

CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- Google account id ("sub")
  email TEXT NOT NULL,            -- lower case, verified by Google
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login TEXT NOT NULL
);
CREATE INDEX users_email ON users (email);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,    -- SHA-256 of the cookie token; the token itself is never stored
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product TEXT NOT NULL,          -- tidyup | nanopdf
  email TEXT NOT NULL,            -- the account that sees this key
  name TEXT NOT NULL,
  exp TEXT NOT NULL,              -- yyyy-MM-dd or never
  plan TEXT NOT NULL,
  license_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,           -- active | revoked
  note TEXT NOT NULL DEFAULT '',
  request_id INTEGER,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX licenses_email ON licenses (email);

CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id),
  email TEXT NOT NULL,
  product TEXT NOT NULL,
  display_name TEXT NOT NULL,     -- name to put in the key
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  slip_type TEXT,                 -- set when a slip is stored in KV as slip:<id>
  status TEXT NOT NULL,           -- pending | approved | rejected
  admin_note TEXT NOT NULL DEFAULT '',
  license_id INTEGER,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX requests_user ON requests (user_id, created_at);
CREATE INDEX requests_status ON requests (status, created_at);
