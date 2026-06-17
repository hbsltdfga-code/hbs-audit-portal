CREATE TABLE IF NOT EXISTS audit_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER,
    photo_name TEXT,
    photo_url TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS training_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    training_type TEXT,
    assigned_date TEXT,
    completion_date TEXT,
    status TEXT
);
CREATE TABLE IF NOT EXISTS competency_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_name TEXT,
    competency_type TEXT,
    expiry_date TEXT,
    status TEXT
);
CREATE TABLE IF NOT EXISTS reaudits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER,
    engineer_name TEXT,
    due_date TEXT,
    completed_date TEXT,
    status TEXT
);
