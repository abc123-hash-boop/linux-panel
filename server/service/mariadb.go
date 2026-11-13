package service

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

var mariaIdentifierRE = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,63}$`)

// MariaDBCredentials is returned only once, immediately after provisioning.
type MariaDBCredentials struct {
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	Host     string `json:"host"`
}

func validMariaIdentifier(value string, max int) bool {
	return len(value) > 0 && len(value) <= max && mariaIdentifierRE.MatchString(value)
}

func sqlStringLiteral(value string) string {
	// MariaDB treats backslashes as escapes in string literals unless the
	// session enables NO_BACKSLASH_ESCAPES. Escape them explicitly because
	// each runMariaDB call starts a fresh client/session.
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, "'", "''")
	return "'" + value + "'"
}

func randomMariaPassword(length int) (string, error) {
	const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*_-"
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(buf), nil
}

// runMariaDB executes SQL over the local Unix socket. The SQL is sent on stdin,
// so passwords never appear in process arguments or shell history.
func runMariaDB(statement string) error {
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names")
	cmd.Stdin = strings.NewReader(statement)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("MariaDB command failed: %s (ensure mariadb-server is running and the Panel process has local administrative socket access)", message)
	}
	return nil
}

func MariaDBCreateDatabase(database, username, password string) (MariaDBCredentials, error) {
	if !validMariaIdentifier(database, 64) {
		return MariaDBCredentials{}, fmt.Errorf("invalid database name: use 1-64 letters, numbers or underscores; start with a letter")
	}
	if !validMariaIdentifier(username, 32) {
		return MariaDBCredentials{}, fmt.Errorf("invalid database username: use 1-32 letters, numbers or underscores; start with a letter")
	}
	if password == "" {
		var err error
		password, err = randomMariaPassword(28)
		if err != nil {
			return MariaDBCredentials{}, fmt.Errorf("generate database password: %w", err)
		}
	}
	if len(password) < 12 || len(password) > 128 {
		return MariaDBCredentials{}, fmt.Errorf("database password must be 12-128 characters")
	}
	if strings.ContainsAny(password, "\x00\r\n") {
		return MariaDBCredentials{}, fmt.Errorf("database password cannot contain control characters")
	}

	dbIdent := "`" + strings.ReplaceAll(database, "`", "``") + "`"
	userLiteral := sqlStringLiteral(username)
	passLiteral := sqlStringLiteral(password)
	// Refuse collisions rather than taking ownership of an existing database/user.
	check := fmt.Sprintf("SELECT (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s), (SELECT COUNT(*) FROM mysql.user WHERE User=%s AND Host='localhost');", sqlStringLiteral(database), sqlStringLiteral(username))
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", check)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return MariaDBCredentials{}, fmt.Errorf("cannot connect to local MariaDB: %s", msg)
	}
	parts := strings.Fields(strings.TrimSpace(out.String()))
	if len(parts) != 2 {
		return MariaDBCredentials{}, fmt.Errorf("unexpected MariaDB preflight response")
	}
	if parts[0] != "0" {
		return MariaDBCredentials{}, fmt.Errorf("database %q already exists", database)
	}
	if parts[1] != "0" {
		return MariaDBCredentials{}, fmt.Errorf("MariaDB user %q@localhost already exists", username)
	}

	if err := runMariaDB(fmt.Sprintf("CREATE USER %s@'localhost' IDENTIFIED BY %s;\n", userLiteral, passLiteral)); err != nil {
		return MariaDBCredentials{}, err
	}
	if err := runMariaDB(fmt.Sprintf("CREATE DATABASE %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n", dbIdent)); err != nil {
		_ = runMariaDB(fmt.Sprintf("DROP USER %s@'localhost';\n", userLiteral))
		return MariaDBCredentials{}, err
	}
	if err := runMariaDB(fmt.Sprintf("GRANT ALL PRIVILEGES ON %s.* TO %s@'localhost';\n", dbIdent, userLiteral)); err != nil {
		_ = runMariaDB(fmt.Sprintf("DROP USER %s@'localhost';\nDROP DATABASE %s;\n", userLiteral, dbIdent))
		return MariaDBCredentials{}, err
	}
	return MariaDBCredentials{Database: database, Username: username, Password: password, Host: "127.0.0.1"}, nil
}

func MariaDBDeleteDatabase(database, username string) error {
	if !validMariaIdentifier(database, 64) || !validMariaIdentifier(username, 32) {
		return fmt.Errorf("invalid database or username")
	}
	return runMariaDB(fmt.Sprintf("DROP USER IF EXISTS %s@'localhost';\nDROP DATABASE IF EXISTS `%s`;\n", sqlStringLiteral(username), strings.ReplaceAll(database, "`", "``")))
}

// MariaDBDatabase describes a non-system schema and its locally granted users.
type MariaDBDatabase struct {
	Name   string   `json:"name"`
	Users  []string `json:"users"`
	Tables int      `json:"tables"`
	Size   uint64   `json:"size"`
}

// MariaDBListDatabases lists application schemas without exposing credentials.
func MariaDBListDatabases() ([]MariaDBDatabase, error) {
	query := `SELECT s.SCHEMA_NAME,
COALESCE((SELECT GROUP_CONCAT(DISTINCT d.User ORDER BY d.User SEPARATOR ',') FROM mysql.db d WHERE d.Db = s.SCHEMA_NAME AND d.Host = 'localhost'), ''),
(SELECT COUNT(*) FROM information_schema.TABLES t WHERE t.TABLE_SCHEMA = s.SCHEMA_NAME),
(SELECT COALESCE(SUM(t.DATA_LENGTH + t.INDEX_LENGTH), 0) FROM information_schema.TABLES t WHERE t.TABLE_SCHEMA = s.SCHEMA_NAME)
FROM information_schema.SCHEMATA s
WHERE s.SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')
ORDER BY s.SCHEMA_NAME;`
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", query)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("cannot list MariaDB databases: %s", msg)
	}
	var databases []MariaDBDatabase
	for _, line := range strings.Split(strings.TrimSpace(out.String()), "\n") {
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) != 4 {
			continue
		}
		db := MariaDBDatabase{Name: fields[0], Tables: 0, Size: 0}
		if fields[1] != "" {
			db.Users = strings.Split(fields[1], ",")
		}
		fmt.Sscanf(fields[2], "%d", &db.Tables)
		fmt.Sscanf(fields[3], "%d", &db.Size)
		databases = append(databases, db)
	}
	if databases == nil {
		databases = []MariaDBDatabase{}
	}
	return databases, nil
}

// MariaDBDeleteManagedDatabase removes the schema and its dedicated localhost
// user, but refuses to remove a user that has grants on another schema.
func MariaDBDeleteManagedDatabase(database, username string) error {
	if !validMariaIdentifier(database, 64) || !validMariaIdentifier(username, 32) {
		return fmt.Errorf("invalid database or username")
	}
	check := fmt.Sprintf("SELECT COUNT(*) FROM mysql.db WHERE User=%s AND Host='localhost' AND Db<>%s;", sqlStringLiteral(username), sqlStringLiteral(database))
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", check)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("cannot verify MariaDB user grants: %s", msg)
	}
	if strings.TrimSpace(out.String()) != "0" {
		return fmt.Errorf("user %q also has privileges on other databases; database was not deleted", username)
	}
	return runMariaDB(fmt.Sprintf("DROP DATABASE IF EXISTS `%s`;\nDROP USER IF EXISTS %s@'localhost';\n", database, sqlStringLiteral(username)))
}

// MariaDBUser describes a local application account and the schemas it can access.
type MariaDBUser struct {
	Username  string   `json:"username"`
	Host      string   `json:"host"`
	Databases []string `json:"databases"`
}

// MariaDBListUsers lists non-system localhost accounts and their schema grants.
func MariaDBListUsers() ([]MariaDBUser, error) {
	query := `SELECT u.User, COALESCE((SELECT GROUP_CONCAT(DISTINCT d.Db ORDER BY d.Db SEPARATOR ',') FROM mysql.db d WHERE d.User=u.User AND d.Host=u.Host), '')
FROM mysql.user u
WHERE u.Host='localhost' AND u.User NOT IN ('root','mysql','mariadb.sys','debian-sys-maint')
ORDER BY u.User;`
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", query)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("cannot list MariaDB users: %s", msg)
	}
	users := make([]MariaDBUser, 0)
	for _, line := range strings.Split(strings.TrimSpace(out.String()), "\n") {
		if line == "" {
			continue
		}
		fields := strings.SplitN(line, "\t", 2)
		if len(fields) != 2 {
			continue
		}
		user := MariaDBUser{Username: fields[0], Host: "localhost", Databases: []string{}}
		if fields[1] != "" {
			user.Databases = strings.Split(fields[1], ",")
		}
		users = append(users, user)
	}
	return users, nil
}

// MariaDBCreateUser creates a local account without granting database access.
func MariaDBCreateUser(username, password string) (MariaDBCredentials, error) {
	if !validMariaIdentifier(username, 32) {
		return MariaDBCredentials{}, fmt.Errorf("invalid database username: use 1-32 letters, numbers or underscores; start with a letter")
	}
	if password == "" {
		var err error
		password, err = randomMariaPassword(28)
		if err != nil {
			return MariaDBCredentials{}, fmt.Errorf("generate database password: %w", err)
		}
	}
	if len(password) < 12 || len(password) > 128 || strings.ContainsAny(password, "\x00\r\n") {
		return MariaDBCredentials{}, fmt.Errorf("database password must be 12-128 characters and contain no control characters")
	}
	user := sqlStringLiteral(username)
	check := fmt.Sprintf("SELECT COUNT(*) FROM mysql.user WHERE User=%s AND Host='localhost';", user)
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", check)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return MariaDBCredentials{}, fmt.Errorf("cannot connect to local MariaDB: %s", msg)
	}
	if strings.TrimSpace(out.String()) != "0" {
		return MariaDBCredentials{}, fmt.Errorf("MariaDB user %q@localhost already exists", username)
	}
	if err := runMariaDB(fmt.Sprintf("CREATE USER %s@'localhost' IDENTIFIED BY %s;\n", user, sqlStringLiteral(password))); err != nil {
		return MariaDBCredentials{}, err
	}
	return MariaDBCredentials{Username: username, Password: password, Host: "127.0.0.1"}, nil
}

// MariaDBResetUserPassword changes a local account password and returns it once.
func MariaDBResetUserPassword(username, password string) (string, error) {
	if !validMariaIdentifier(username, 32) {
		return "", fmt.Errorf("invalid database username")
	}
	if password == "" {
		var err error
		password, err = randomMariaPassword(28)
		if err != nil {
			return "", fmt.Errorf("generate database password: %w", err)
		}
	}
	if len(password) < 12 || len(password) > 128 || strings.ContainsAny(password, "\x00\r\n") {
		return "", fmt.Errorf("database password must be 12-128 characters and contain no control characters")
	}
	check := fmt.Sprintf("SELECT COUNT(*) FROM mysql.user WHERE User=%s AND Host='localhost';", sqlStringLiteral(username))
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", check)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("cannot verify MariaDB user: %s", msg)
	}
	if strings.TrimSpace(out.String()) != "1" {
		return "", fmt.Errorf("MariaDB user %q@localhost does not exist", username)
	}
	if err := runMariaDB(fmt.Sprintf("ALTER USER %s@'localhost' IDENTIFIED BY %s;\n", sqlStringLiteral(username), sqlStringLiteral(password))); err != nil {
		return "", err
	}
	return password, nil
}

// MariaDBGrantDatabase grants full privileges on one existing schema to a local user.
func MariaDBGrantDatabase(username, database string) error {
	if !validMariaIdentifier(username, 32) || !validMariaIdentifier(database, 64) {
		return fmt.Errorf("invalid database or username")
	}
	check := fmt.Sprintf("SELECT (SELECT COUNT(*) FROM mysql.user WHERE User=%s AND Host='localhost'), (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s);", sqlStringLiteral(username), sqlStringLiteral(database))
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", check)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("cannot verify MariaDB user/database: %s", msg)
	}
	parts := strings.Fields(strings.TrimSpace(out.String()))
	if len(parts) != 2 {
		return fmt.Errorf("unexpected MariaDB preflight response")
	}
	if parts[0] != "1" {
		return fmt.Errorf("MariaDB user %q@localhost does not exist", username)
	}
	if parts[1] != "1" {
		return fmt.Errorf("database %q does not exist", database)
	}
	return runMariaDB(fmt.Sprintf("GRANT ALL PRIVILEGES ON `%s`.* TO %s@'localhost';\n", database, sqlStringLiteral(username)))
}

// MariaDBRevokeDatabase removes one schema grant without dropping the schema.
func MariaDBRevokeDatabase(username, database string) error {
	if !validMariaIdentifier(username, 32) || !validMariaIdentifier(database, 64) {
		return fmt.Errorf("invalid database or username")
	}
	check := fmt.Sprintf("SELECT COUNT(*) FROM mysql.user WHERE User=%s AND Host='localhost';", sqlStringLiteral(username))
	cmd := exec.Command("mariadb", "--protocol=socket", "--batch", "--skip-column-names", "--execute", check)
	var out, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("cannot verify MariaDB user: %s", msg)
	}
	if strings.TrimSpace(out.String()) != "1" {
		return fmt.Errorf("MariaDB user %q@localhost does not exist", username)
	}
	return runMariaDB(fmt.Sprintf("REVOKE ALL PRIVILEGES ON `%s`.* FROM %s@'localhost';\n", database, sqlStringLiteral(username)))
}
