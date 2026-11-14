package database

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) func() {
	t.Helper()
	oldDB := DB
	oldToken := setupToken
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "panel.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	DB = db
	setupToken = "test-onboarding-token"
	return func() {
		_ = db.Close()
		DB = oldDB
		setupToken = oldToken
	}
}

func TestInitializeSetupRotatesTokenAndSkipsExistingUsers(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	setupToken = ""
	initializeSetup()
	if len(setupToken) != 64 {
		t.Fatalf("expected a 64-character random token, got length %d", len(setupToken))
	}
	if _, err := DB.Exec("INSERT INTO users(username,password) VALUES(?,?)", "existingadmin", "hash"); err != nil {
		t.Fatal(err)
	}
	initializeSetup()
	if setupToken != "" {
		t.Fatal("existing users must prevent onboarding token generation")
	}
}

func TestCompleteSetupCreatesFirstAdminAndConsumesToken(t *testing.T) {
	cleanup := setupTestDB(t)
	defer cleanup()

	if IsInitialized() {
		t.Fatal("fresh database must not be initialized")
	}
	if err := CompleteSetup("wrong-token", "paneladmin", "a-strong-password"); !errors.Is(err, ErrInvalidSetupToken) {
		t.Fatalf("expected invalid token error, got %v", err)
	}
	if err := CompleteSetup("test-onboarding-token", "paneladmin", "a-strong-password"); err != nil {
		t.Fatalf("CompleteSetup failed: %v", err)
	}
	if !IsInitialized() {
		t.Fatal("database should be initialized after setup")
	}
	var hash string
	if err := DB.QueryRow("SELECT password FROM users WHERE username=?", "paneladmin").Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("a-strong-password")); err != nil {
		t.Fatalf("stored password hash does not match: %v", err)
	}
	if err := CompleteSetup("test-onboarding-token", "anotheradmin", "another-password"); !errors.Is(err, ErrSetupNotRequired) {
		t.Fatalf("expected consumed token error, got %v", err)
	}
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected exactly one initial admin, got %d", count)
	}
}
