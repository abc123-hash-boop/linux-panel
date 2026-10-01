package database

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"

	"golang.org/x/crypto/bcrypt"
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

	createAdmin()

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

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP

	);

	CREATE TABLE IF NOT EXISTS copilot_providers(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		name TEXT UNIQUE NOT NULL,

		icon TEXT DEFAULT '',

		api_base TEXT NOT NULL

	);

	CREATE TABLE IF NOT EXISTS copilot_models(

		id INTEGER PRIMARY KEY AUTOINCREMENT,

		provider_id INTEGER REFERENCES copilot_providers(id) ON DELETE CASCADE,

		name TEXT NOT NULL

	);

	`

	_, err := DB.Exec(sql)

	if err != nil {

		log.Fatal(err)

	}

}

func createAdmin() {

	var count int

	DB.QueryRow(
		"SELECT COUNT(*) FROM users",
	).Scan(&count)

	if count > 0 {

		return

	}

	hash, _ :=
		bcrypt.GenerateFromPassword(
			[]byte("123456"),
			bcrypt.DefaultCost,
		)

	_, err :=
		DB.Exec(
			"INSERT INTO users(username,password) VALUES(?,?)",
			"admin",
			string(hash),
		)

	if err != nil {

		log.Fatal(err)

	}

	log.Println(
		"默认管理员创建 admin / 123456",
	)

}
