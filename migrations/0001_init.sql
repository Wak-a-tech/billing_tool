-- Compteur de factures partagé (une seule ligne).
CREATE TABLE counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_seq INTEGER NOT NULL CHECK (next_seq >= 1)
);
INSERT INTO counter (id, next_seq) VALUES (1, 1);

-- Réglages partagés : préfixe de numérotation, logo.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT
);

-- Entreprises enregistrées (émettrices et clientes).
CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('issuer', 'client')),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT
);
CREATE INDEX parties_kind ON parties (kind);

-- Historique des factures émises. Une facture n'est jamais supprimée :
-- `snapshot` contient tout ce qu'il faut pour régénérer le PDF à l'identique.
CREATE TABLE invoices (
  seq INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  issuer_name TEXT,
  client_name TEXT,
  currency TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tva_total REAL NOT NULL,
  total REAL NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT NOT NULL
);
