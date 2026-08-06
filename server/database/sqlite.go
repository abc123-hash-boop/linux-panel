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
