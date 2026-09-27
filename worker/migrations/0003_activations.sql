-- Machines that activated a License Key. A key may be active on up to 2 machines.

CREATE TABLE activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER NOT NULL,
  machine TEXT NOT NULL,          -- SHA-256 hex of the machine identifiers; never the raw values
  machine_name TEXT NOT NULL,     -- shown to the customer so they can tell machines apart
  app_version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,           -- active | removed
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  removed_at TEXT
);
CREATE INDEX activations_license ON activations (license_id, status);
CREATE UNIQUE INDEX activations_license_machine ON activations (license_id, machine);

-- Simple fixed-window counters for the public activation endpoint.
CREATE TABLE rate_limits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset_at INTEGER NOT NULL       -- unix seconds
);
