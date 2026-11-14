package database

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"log"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

var (
	setupMu    sync.Mutex
	setupToken string

	ErrSetupNotRequired  = errors.New("setup is already completed")
	ErrInvalidSetupToken = errors.New("invalid onboarding token")
)

// initializeSetup creates a fresh one-time token only when no administrator exists.
// The token is intentionally kept in memory and rotated on every restart until setup completes.
func initializeSetup() {
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		log.Fatal("检查管理员账户失败: ", err)
	}

	setupMu.Lock()
	defer setupMu.Unlock()
	setupToken = ""
	if count > 0 {
		return
	}

	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		log.Fatal("生成初始化 Token 失败: ", err)
	}
	setupToken = hex.EncodeToString(raw[:])

	log.Printf("[info] Token: %s\n", setupToken)
	log.Println("[info] Complete the initial setup in your browser. This token is valid only for the current startup and expires after setup.")
}

// IsInitialized reports whether the first administrator account exists.
func IsInitialized() bool {
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return false
	}
	return count > 0
}

// CompleteSetup validates the startup token and atomically creates the first administrator.
func CompleteSetup(token, username, password string) error {
	setupMu.Lock()
	defer setupMu.Unlock()

	if setupToken == "" {
		return ErrSetupNotRequired
	}
	if subtle.ConstantTimeCompare([]byte(token), []byte(setupToken)) != 1 {
		return ErrInvalidSetupToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var count int
	if err := tx.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		setupToken = ""
		return ErrSetupNotRequired
	}

	if _, err := tx.Exec("INSERT INTO users(username,password) VALUES(?,?)", username, string(hash)); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	// Invalidate the token only after the administrator has been committed.
	setupToken = ""
	log.Printf("[info] Initial setup completed. Administrator %q created.", username)
	return nil
}
