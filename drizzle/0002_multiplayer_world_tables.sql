DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧑',
  color INTEGER NOT NULL DEFAULT 15105503,
  city_key TEXT NOT NULL DEFAULT 'sz',
  loc_id TEXT NOT NULL DEFAULT 'home',
  game_day INTEGER NOT NULL DEFAULT 1,
  money INTEGER NOT NULL DEFAULT 0,
  career_idx INTEGER NOT NULL DEFAULT 0,
  apec_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'playing',
  result_title TEXT,
  last_seen INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  city_key TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE feed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'life',
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
