package service

import "testing"

func TestValidMariaIdentifier(t *testing.T) {
	valid := []string{"site", "site_01", "A1", "db_name"}
	for _, value := range valid {
		if !validMariaIdentifier(value, 64) {
			t.Errorf("expected %q to be valid", value)
		}
	}
	invalid := []string{"", "1site", "has-dash", "has space", "x`y", "a.b"}
	for _, value := range invalid {
		if validMariaIdentifier(value, 64) {
			t.Errorf("expected %q to be invalid", value)
		}
	}
	if validMariaIdentifier("abcdefghijklmnopqrstuvwxyz1234567", 32) {
		t.Error("username longer than 32 characters should be rejected")
	}
}

func TestSQLStringLiteral(t *testing.T) {
	tests := map[string]string{
		"a'b":   "'a''b'",
		`a\b`:   `'a\\b'`,
		`a\b'c`: `'a\\b''c'`,
	}
	for input, want := range tests {
		if got := sqlStringLiteral(input); got != want {
			t.Errorf("sqlStringLiteral(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestRandomMariaPassword(t *testing.T) {
	password, err := randomMariaPassword(28)
	if err != nil {
		t.Fatal(err)
	}
	if len(password) != 28 {
		t.Fatalf("got password length %d, want 28", len(password))
	}
}

func TestMariaDBUserManagementRejectsInvalidInput(t *testing.T) {
	if _, err := MariaDBCreateUser("bad-name", "LongEnoughPassword_123"); err == nil {
		t.Fatal("expected invalid username to be rejected")
	}
	if _, err := MariaDBCreateUser("valid_user", "short"); err == nil {
		t.Fatal("expected short password to be rejected")
	}
	if _, err := MariaDBResetUserPassword("bad-name", "LongEnoughPassword_123"); err == nil {
		t.Fatal("expected invalid username for password reset to be rejected")
	}
	if err := MariaDBGrantDatabase("bad-name", "valid_db"); err == nil {
		t.Fatal("expected invalid grant username to be rejected")
	}
	if err := MariaDBRevokeDatabase("valid_user", "bad-name"); err == nil {
		t.Fatal("expected invalid revoke database to be rejected")
	}
}
