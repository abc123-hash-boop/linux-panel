package database

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init() {

	var err error

	DB, err =
		sql.Open(
			"sqlite",
			"panel.db",
		)

	if err != nil {

		log.Fatal(err)

	}

	createTable()

	initializeSetup()

}

func createTable() {

	sql := `

	CREATE TABLE IF NOT EXISTS users(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		username TEXT UNIQUE,

		password TEXT,

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP

	);

	CREATE TABLE IF NOT EXISTS settings(

		key TEXT PRIMARY KEY,

		value TEXT

	);

	CREATE TABLE IF NOT EXISTS copilot_sessions(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		name TEXT NOT NULL,

		model TEXT DEFAULT 'gpt-4o',

		api_key TEXT DEFAULT '',

		api_base TEXT DEFAULT 'https://api.openai.com/v1',

		recall_sessions TEXT DEFAULT '{}',

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP

	);

	CREATE TABLE IF NOT EXISTS copilot_providers(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		name TEXT UNIQUE NOT NULL,

		icon TEXT DEFAULT '',

		api_base TEXT NOT NULL,

		api_key TEXT DEFAULT ''

	);

	CREATE TABLE IF NOT EXISTS copilot_models(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		provider_id INTEGER REFERENCES copilot_providers(id) ON DELETE CASCADE,

		name TEXT NOT NULL

	);

	CREATE TABLE IF NOT EXISTS copilot_messages(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		session_id INTEGER NOT NULL,

		role TEXT NOT NULL,

		content TEXT NOT NULL,

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP

	);

	`

	_, err := DB.Exec(sql)

	if err != nil {

		log.Fatal(err)

	}

	// 迁移：为旧数据库补充 recall_sessions 列
	DB.Exec("ALTER TABLE copilot_sessions ADD COLUMN recall_sessions TEXT DEFAULT '{}'")

}
