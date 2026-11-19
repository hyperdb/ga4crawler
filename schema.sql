CREATE TABLE IF NOT EXISTS daily_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT NOT NULL,
    site_name TEXT NOT NULL,
    target_date TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    sessions INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_property_date UNIQUE (property_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_property_date ON daily_analytics(property_id, target_date);