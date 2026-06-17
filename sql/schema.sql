DROP TABLE IF EXISTS audit_photos;
DROP TABLE IF EXISTS audits;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('engineer','manager','director')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_ref TEXT UNIQUE NOT NULL,
  engineer_email TEXT NOT NULL,
  engineer_name TEXT NOT NULL,
  manager_email TEXT,
  site_name TEXT NOT NULL,
  client_name TEXT,
  audit_date TEXT NOT NULL,
  appliance_details TEXT,
  score INTEGER NOT NULL,
  result TEXT NOT NULL,
  actions_required TEXT,
  training_required TEXT,
  reaudit_required INTEGER DEFAULT 0,
  reaudit_date TEXT,
  signature TEXT,
  audit_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_ref TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  data_url TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name,email,pin,role) VALUES
('Peter Taylor','peter@hbs.local','1234','manager'),
('Compliance Manager','compliance@hbs.local','1234','manager'),
('Engineer One','engineer1@hbs.local','1234','engineer'),
('Engineer Two','engineer2@hbs.local','1234','engineer'),
('Engineer Three','engineer3@hbs.local','1234','engineer');
