package service

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// generateRandomPassword 生成随机密码
func generateRandomPassword(length int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	b := make([]byte, length)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}

// ============ Nginx ============

type NginxInfo struct {
	Installed bool   `json:"installed"`
	Binary    string `json:"binary"`
	Version   string `json:"version"`
	Running   bool   `json:"running"`
	ConfigOK  bool   `json:"config_ok"`
	ConfigMsg string `json:"config_msg"`
}

type NginxSite struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Enabled     bool   `json:"enabled"`
	Domains     string `json:"domains"`
	Root        string `json:"root"`
	ProxyTarget string `json:"proxy_target"`
	Kind        string `json:"kind"`
	SSL         bool   `json:"ssl"`
}

var (
	serverNameRE = regexp.MustCompile(`(?m)server_name\s+([^;]+);`)
	rootRE       = regexp.MustCompile(`(?m)root\s+([^;]+);`)
	proxyPassRE  = regexp.MustCompile(`(?m)proxy_pass\s+([^;]+);`)
	listenSSLRE  = regexp.MustCompile(`(?mi)listen\s+[^;]*(443|ssl)`)
	certRE       = regexp.MustCompile(`(?mi)ssl_certificate\s+([^;]+);`)
	siteNameRE   = regexp.MustCompile(`^[A-Za-z0-9_.-]+\.conf$`)
)

func describeNginxSite(site *NginxSite) {
	b, err := os.ReadFile(site.Path)
	if err != nil {
		return
	}
	content := string(b)
	activeContent := regexp.MustCompile(`(?m)^\s*#.*$`).ReplaceAllString(content, "")
	var domains []string
	for _, m := range serverNameRE.FindAllStringSubmatch(activeContent, -1) {
		if len(m) > 1 {
			domains = append(domains, strings.Fields(m[1])...)
		}
	}
	if len(domains) > 0 {
		seen := map[string]bool{}
		unique := make([]string, 0, len(domains))
		for _, d := range domains {
			if !seen[d] {
				seen[d] = true
				unique = append(unique, d)
			}
		}
		site.Domains = strings.Join(unique, ", ")
	}
	if m := rootRE.FindStringSubmatch(activeContent); len(m) > 1 {
		site.Root = strings.TrimSpace(m[1])
	}
	if m := proxyPassRE.FindStringSubmatch(activeContent); len(m) > 1 {
		site.ProxyTarget = strings.TrimSpace(m[1])
	}
	site.SSL = listenSSLRE.MatchString(activeContent) || certRE.MatchString(activeContent)
	switch {
	case strings.Contains(activeContent, "fastcgi_pass"):
		site.Kind = "php"
	case strings.Contains(activeContent, "upstream "):
		site.Kind = "loadbalance"
	case regexp.MustCompile(`(?m)\breturn\s+30[1278]\s+`).MatchString(activeContent):
		site.Kind = "redirect"
	case site.ProxyTarget != "":
		site.Kind = "proxy"
	case site.Root != "":
		site.Kind = "static"
	default:
		site.Kind = "custom"
	}
}

func nginxSitePath(name string) (string, error) {
	if name == "" || filepath.Base(name) != name || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return "", fmt.Errorf("invalid site name")
	}
	for _, dir := range []string{"/etc/nginx/sites-available", "/etc/nginx/conf.d"} {
		for _, candidate := range []string{filepath.Join(dir, name), filepath.Join(dir, name+".disabled")} {
			if st, err := os.Lstat(candidate); err == nil && st.Mode().IsRegular() {
				return candidate, nil
			}
		}
	}
	return "", os.ErrNotExist
}

func NginxStatus() NginxInfo {
	st := NginxInfo{}

	if bin, err := exec.LookPath("nginx"); err == nil {
		st.Installed = true
		st.Binary = bin
		out, _ := exec.Command("nginx", "-v").Output()
		st.Version = strings.TrimSpace(string(out))
		// nginx -v 输出到 stderr
	} else {
		// 试找常见路径
		for _, p := range []string{"/usr/sbin/nginx", "/usr/local/nginx/sbin/nginx"} {
			if _, err := os.Stat(p); err == nil {
				st.Installed = true
				st.Binary = p
			}
		}
	}

	if st.Installed {
		// 版本
		out, _ := exec.Command(st.Binary, "-v").CombinedOutput()
		st.Version = strings.TrimSpace(string(out))

		// 是否运行
		if out, err := exec.Command("pgrep", "-x", "nginx").Output(); err == nil && len(strings.TrimSpace(string(out))) > 0 {
			st.Running = true
		}

		// 配置校验
		if out, err := exec.Command(st.Binary, "-t").CombinedOutput(); err != nil {
			st.ConfigOK = false
			st.ConfigMsg = string(out)
		} else {
			st.ConfigOK = true
			st.ConfigMsg = string(out)
		}
	}

	return st
}

func NginxSites() []NginxSite {
	sites := []NginxSite{}
	availDir, enabledDir, confDir := "/etc/nginx/sites-available", "/etc/nginx/sites-enabled", "/etc/nginx/conf.d"
	seen := map[string]bool{}
	for _, item := range []struct {
		dir       string
		available bool
	}{{availDir, true}, {confDir, false}} {
		entries, err := os.ReadDir(item.dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			entryName := e.Name()
			disabled := strings.HasSuffix(entryName, ".conf.disabled")
			if item.available {
				if strings.HasPrefix(entryName, ".") || strings.HasSuffix(entryName, ".disabled") {
					continue
				}
			} else if !strings.HasSuffix(entryName, ".conf") && !disabled {
				continue
			}
			name := strings.TrimSuffix(entryName, ".disabled")
			path := filepath.Join(item.dir, entryName)
			if seen[path] {
				continue
			}
			seen[path] = true
			enabled := !disabled
			if item.available {
				link := filepath.Join(enabledDir, entryName)
				if st, err := os.Lstat(link); err == nil && (st.Mode()&os.ModeSymlink != 0 || st.Mode().IsRegular()) {
					enabled = true
				} else {
					enabled = false
				}
			}
			st, err := os.Stat(path)
			if err != nil || !st.Mode().IsRegular() {
				continue
			}
			site := NginxSite{Name: name, Path: path, Enabled: enabled}
			describeNginxSite(&site)
			sites = append(sites, site)
		}
	}
	return sites
}

func NginxReadSite(name string) (string, string, error) {
	p, err := nginxSitePath(name)
	if err != nil {
		return "", "", err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return "", "", err
	}
	h := sha256.Sum256(b)
	return string(b), hex.EncodeToString(h[:]), nil
}

func nginxConfigTest() error {
	out, err := exec.Command(nginxBin(), "-t").CombinedOutput()
	if err != nil {
		return fmt.Errorf("nginx config test failed: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

func nginxAtomicWrite(path string, data []byte, mode os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".panel-nginx-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func nginxBackup(path string, data []byte) (string, error) {
	backupDir := "/var/backups/linux-panel/nginx"
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return "", err
	}
	name := filepath.Base(path) + "." + fmt.Sprintf("%d", time.Now().UnixNano()) + ".bak"
	backup := filepath.Join(backupDir, name)
	if err := os.WriteFile(backup, data, 0600); err != nil {
		return "", err
	}
	return backup, nil
}

func NginxUpdateSite(name, content, expectedVersion string) error {
	p, err := nginxSitePath(name)
	if err != nil {
		return err
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("configuration cannot be empty")
	}
	old, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	if expectedVersion == "" {
		return fmt.Errorf("resource version required")
	}
	h := sha256.Sum256(old)
	if hex.EncodeToString(h[:]) != expectedVersion {
		return fmt.Errorf("resource changed since it was loaded; refresh before saving")
	}
	info, err := os.Stat(p)
	if err != nil {
		return err
	}
	if _, err := nginxBackup(p, old); err != nil {
		return fmt.Errorf("backup current config: %w", err)
	}
	if err := nginxAtomicWrite(p, []byte(content), info.Mode().Perm()); err != nil {
		return err
	}
	if err := nginxConfigTest(); err != nil {
		if restoreErr := nginxAtomicWrite(p, old, info.Mode().Perm()); restoreErr != nil {
			return fmt.Errorf("%v; additionally failed to restore previous config: %w", err, restoreErr)
		}
		return fmt.Errorf("%v; previous config restored", err)
	}
	if err := NginxReload(); err != nil {
		_ = nginxAtomicWrite(p, old, info.Mode().Perm())
		_ = nginxConfigTest()
		return fmt.Errorf("reload failed; previous config restored: %w", err)
	}
	return nil
}

func NginxEnableSite(name string) error {
	p, err := nginxSitePath(name)
	if err != nil {
		return err
	}
	if strings.HasPrefix(p, "/etc/nginx/conf.d/") {
		if strings.HasSuffix(p, ".disabled") {
			dst := strings.TrimSuffix(p, ".disabled")
			if _, err := os.Lstat(dst); err == nil {
				return fmt.Errorf("site config already exists: %s", dst)
			}
			if err := os.Rename(p, dst); err != nil {
				return err
			}
		} else {
			return fmt.Errorf("site is already enabled")
		}
	} else {
		avail := filepath.Join("/etc/nginx/sites-available", name)
		enabled := filepath.Join("/etc/nginx/sites-enabled", name)
		if _, err := os.Stat(avail); err != nil {
			return err
		}
		if _, err := os.Lstat(enabled); err == nil {
			return fmt.Errorf("site is already enabled")
		}
		if err := os.Symlink(avail, enabled); err != nil {
			return err
		}
	}
	if err := nginxConfigTest(); err != nil {
		if strings.HasPrefix(p, "/etc/nginx/conf.d/") {
			_ = os.Rename(strings.TrimSuffix(p, ".disabled"), p)
		} else {
			_ = os.Remove(filepath.Join("/etc/nginx/sites-enabled", name))
		}
		return err
	}
	return NginxReload()
}

func NginxReload() error { return NginxAction("reload") }

func NginxDisableSite(name string) error {
	p, err := nginxSitePath(name)
	if err != nil {
		return err
	}
	if strings.HasPrefix(p, "/etc/nginx/conf.d/") {
		if strings.HasSuffix(p, ".disabled") {
			return fmt.Errorf("site is already disabled")
		}
		if err := os.Rename(p, p+".disabled"); err != nil {
			return err
		}
	} else {
		enabled := filepath.Join("/etc/nginx/sites-enabled", name)
		if _, err := os.Lstat(enabled); err != nil {
			return fmt.Errorf("site is not enabled")
		}
		if err := os.Remove(enabled); err != nil {
			return err
		}
	}
	if err := nginxConfigTest(); err != nil {
		if strings.HasPrefix(p, "/etc/nginx/conf.d/") {
			_ = os.Rename(p+".disabled", p)
		} else {
			avail := filepath.Join("/etc/nginx/sites-available", name)
			_ = os.Symlink(avail, filepath.Join("/etc/nginx/sites-enabled", name))
		}
		return err
	}
	return NginxReload()
}

func NginxAction(action string) error {
	if !nginxInstalled() {
		return errNginxNotInstalled
	}
	switch action {
	case "start", "stop", "restart", "reload":
	default:
		return fmt.Errorf("unsupported nginx action: %s", action)
	}
	if err := exec.Command("systemctl", action, "nginx").Run(); err == nil {
		return nil
	}
	switch action {
	case "start":
		return exec.Command(nginxBin(), "-c", "/etc/nginx/nginx.conf").Run()
	case "stop", "restart", "reload":
		return exec.Command(nginxBin(), "-s", action).Run()
	}
	return fmt.Errorf("nginx action failed")
}

func NginxCreateSite(name, content string) error {
	if name == "" {
		return fmt.Errorf("site name required")
	}
	if !strings.HasSuffix(name, ".conf") {
		name += ".conf"
	}
	if !siteNameRE.MatchString(name) || strings.Contains(name, "..") {
		return fmt.Errorf("invalid site name")
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("site configuration cannot be empty")
	}
	activeContent := regexp.MustCompile(`(?m)^\s*#.*$`).ReplaceAllString(content, "")
	if !strings.Contains(activeContent, "server {") || !serverNameRE.MatchString(activeContent) {
		return fmt.Errorf("a site must contain a server block and server_name")
	}
	availDir, enabledDir := "/etc/nginx/sites-available", "/etc/nginx/sites-enabled"
	if err := os.MkdirAll(availDir, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(enabledDir, 0755); err != nil {
		return err
	}
	for _, candidate := range []string{filepath.Join(availDir, name), filepath.Join(enabledDir, name), filepath.Join("/etc/nginx/conf.d", name), filepath.Join("/etc/nginx/conf.d", name+".disabled")} {
		if _, err := os.Lstat(candidate); err == nil {
			return fmt.Errorf("site config already exists: %s", candidate)
		}
	}
	// Refuse a second site claiming an existing server_name.
	newNames := strings.Fields(strings.ReplaceAll(serverNameRE.FindStringSubmatch(activeContent)[1], "_", ""))
	for _, site := range NginxSites() {
		for _, existing := range strings.Split(site.Domains, ",") {
			for _, candidate := range newNames {
				if strings.TrimSpace(existing) == candidate {
					return fmt.Errorf("domain already belongs to site %s: %s", site.Name, candidate)
				}
			}
		}
	}
	// For a newly-created PHP site, provision its document root and a small
	// front controller so an empty directory does not immediately return 403/404.
	if strings.Contains(activeContent, "fastcgi_pass") {
		if match := rootRE.FindStringSubmatch(activeContent); len(match) > 1 {
			docRoot := filepath.Clean(strings.TrimSpace(match[1]))
			if filepath.IsAbs(docRoot) && (docRoot == "/var/www" || strings.HasPrefix(docRoot, "/var/www/")) {
				if err := os.MkdirAll(docRoot, 0755); err != nil {
					return fmt.Errorf("create PHP document root: %w", err)
				}
				indexFile := filepath.Join(docRoot, "index.php")
				if _, err := os.Stat(indexFile); os.IsNotExist(err) {
					placeholder := []byte("<?php\nhttp_response_code(200);\necho 'PHP site is ready. Upload your application files to this directory.';\n")
					if err := os.WriteFile(indexFile, placeholder, 0644); err != nil {
						return fmt.Errorf("create PHP front controller: %w", err)
					}
				}
			}
		}
	}
	filePath := filepath.Join(availDir, name)
	if err := nginxAtomicWrite(filePath, []byte(content), 0644); err != nil {
		return err
	}
	symlinkPath := filepath.Join(enabledDir, name)
	if err := os.Symlink(filePath, symlinkPath); err != nil {
		_ = os.Remove(filePath)
		return err
	}
	if err := nginxConfigTest(); err != nil {
		_ = os.Remove(symlinkPath)
		_ = os.Remove(filePath)
		return err
	}
	if err := NginxReload(); err != nil {
		_ = os.Remove(symlinkPath)
		_ = os.Remove(filePath)
		return fmt.Errorf("reload failed: %w", err)
	}
	return nil
}

func NginxDeleteSite(name string) error {
	p, err := nginxSitePath(name)
	if err != nil {
		return err
	}
	if !strings.HasPrefix(p, "/etc/nginx/sites-available/") && !strings.HasPrefix(p, "/etc/nginx/conf.d/") {
		return fmt.Errorf("unsupported site config location")
	}
	if strings.HasSuffix(p, ".disabled") {
		return os.Remove(p)
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	if _, err := nginxBackup(p, data); err != nil {
		return fmt.Errorf("backup current config: %w", err)
	}
	backupPath := p + ".panel-delete-backup"
	if err := os.Rename(p, backupPath); err != nil {
		return err
	}
	link := filepath.Join("/etc/nginx/sites-enabled", name)
	linkRemoved := false
	if _, err := os.Lstat(link); err == nil {
		if err := os.Remove(link); err != nil {
			_ = os.Rename(backupPath, p)
			return err
		}
		linkRemoved = true
	}
	if err := nginxConfigTest(); err != nil {
		_ = os.Rename(backupPath, p)
		if linkRemoved {
			_ = os.Symlink(p, link)
		}
		return fmt.Errorf("delete rejected because nginx config test failed: %w", err)
	}
	if err := NginxReload(); err != nil {
		_ = os.Rename(backupPath, p)
		if linkRemoved {
			_ = os.Symlink(p, link)
		}
		_ = nginxConfigTest()
		return fmt.Errorf("reload failed; site restored: %w", err)
	}
	if err := os.Remove(backupPath); err != nil {
		return fmt.Errorf("site disabled but backup cleanup failed: %w", err)
	}
	return nil
}

func nginxInstalled() bool {
	_, err := exec.LookPath("nginx")
	if err == nil {
		return true
	}
	for _, p := range []string{"/usr/sbin/nginx", "/usr/local/nginx/sbin/nginx"} {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}

func nginxBin() string {
	if b, err := exec.LookPath("nginx"); err == nil {
		return b
	}
	if _, err := os.Stat("/usr/sbin/nginx"); err == nil {
		return "/usr/sbin/nginx"
	}
	return "/usr/local/nginx/sbin/nginx"
}

type errString string

func (e errString) Error() string { return string(e) }

var errNginxNotInstalled = errString("nginx is not installed")

// ============ SQLite ============

type SqlTable struct {
	Name string `json:"name"`
	Rows int64  `json:"rows"`
}

type SqlDB struct {
	Path      string     `json:"path"`
	Size      int64      `json:"size"`
	Tables    []SqlTable `json:"tables"`
	CreatedAt string     `json:"created_at"`
}

type CreateDBRequest struct {
	Name     string `json:"name"`
	Password string `json:"password"`
}

type CreateDBResponse struct {
	Path     string `json:"path"`
	Password string `json:"password"`
}

// SqlCreateDB 创建新的 SQLite 数据库（PHP 站点附加 DB）
// 若 password 为空则自动生成 16 位随机密码
func SqlCreateDB(req CreateDBRequest) (CreateDBResponse, error) {
	if req.Name == "" {
		return CreateDBResponse{}, fmt.Errorf("database name required")
	}

	saveDir := "/var/lib/sqlite"
	if _, err := os.Stat("/var/lib/sqlite"); err != nil {
		if _, err := os.Stat("/data"); err == nil {
			saveDir = "/data/sqlite"
		}
	}

	if _, err := os.Stat(saveDir); err != nil {
		if err := os.MkdirAll(saveDir, 0755); err != nil {
			return CreateDBResponse{}, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	dbPath := filepath.Join(saveDir, filepath.Base(req.Name))
	if !strings.HasSuffix(dbPath, ".db") {
		dbPath += ".db"
	}

	if _, err := os.Stat(dbPath); err == nil {
		return CreateDBResponse{}, fmt.Errorf("database %s already exists", req.Name)
	}

	passwd := req.Password
	if passwd == "" {
		passwd = generateRandomPassword(16)
	}

	createSQL := `
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT
);
`
	db, err := sql.Open("sqlite", filepath.ToSlash(dbPath))
	if err != nil {
		return CreateDBResponse{}, err
	}
	if _, err := db.Exec(createSQL); err != nil {
		db.Close()
		os.Remove(dbPath)
		return CreateDBResponse{}, err
	}
	if _, err := db.Exec(`INSERT INTO users (username, password) VALUES (?, ?)`, "admin", passwd); err != nil {
		db.Close()
		os.Remove(dbPath)
		return CreateDBResponse{}, err
	}
	db.Close()

	if err := os.Chmod(dbPath, 0600); err != nil {
		return CreateDBResponse{}, fmt.Errorf("failed to set permissions: %w", err)
	}

	// 记录创建时间与密码（写入 manifest 文件，方便前端读取）
	manifest := dbPath + ".manifest"
	manifestData := fmt.Sprintf("path=%s\npassword=%s\ncreated=%s\n", dbPath, passwd, "now")
	if err := os.WriteFile(manifest, []byte(manifestData), 0600); err != nil {
		return CreateDBResponse{}, fmt.Errorf("failed to write db manifest: %w", err)
	}

	return CreateDBResponse{
		Path:     dbPath,
		Password: passwd,
	}, nil
}

// SqlDeleteDB 删除附加数据库（配合站点删除）
func SqlDeleteDB(dbPath string) error {
	if dbPath == "" {
		return fmt.Errorf("database path required")
	}
	abs, err := filepath.Abs(filepath.Clean(dbPath))
	if err != nil {
		return err
	}
	allowed := false
	for _, root := range []string{"/var/lib", "/data", "/srv", "/opt", "/home", "/root", "/tmp"} {
		rootAbs, _ := filepath.Abs(root)
		if strings.HasPrefix(abs, rootAbs+string(os.PathSeparator)) {
			allowed = true
			break
		}
	}
	base := filepath.Base(abs)
	if !allowed || !(strings.HasSuffix(base, ".db") || strings.HasSuffix(base, ".sqlite") || strings.HasSuffix(base, ".sqlite3")) {
		return fmt.Errorf("database path is outside the allowed SQLite locations")
	}
	info, err := os.Lstat(abs)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("database path must be a regular file")
	}
	if err := os.Remove(abs); err != nil {
		return err
	}
	manifest := abs + ".manifest"
	_ = os.Remove(manifest)
	return nil
}

func SqlListDBs() []SqlDB {
	// 扫描常见目录
	roots := []string{
		"/var/lib",
		"/data",
		"/srv",
		"/opt",
		"/home",
		"/root",
		"/tmp",
	}

	var dbs []SqlDB
	seen := map[string]bool{}

	for _, root := range roots {
		// 限制扫描深度，避免过慢
		filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() {
				// 限制深度 5
				depth := strings.Count(strings.TrimPrefix(path, root), "/")
				if depth > 5 {
					return filepath.SkipDir
				}
				// 跳过 node_modules / .git
				base := filepath.Base(path)
				if base == "node_modules" || base == ".git" || base == ".browser-profile" {
					return filepath.SkipDir
				}
				return nil
			}
			name := filepath.Base(path)
			if !strings.HasSuffix(name, ".db") && !strings.HasSuffix(name, ".sqlite") && !strings.HasSuffix(name, ".sqlite3") {
				return nil
			}
			if seen[path] {
				return nil
			}
			seen[path] = true

			db := SqlDB{Path: path, Size: info.Size()}
			db.Tables = sqlTables(path)
			dbs = append(dbs, db)
			return nil
		})
	}

	return dbs
}

func sqlTables(path string) []SqlTable {
	var tables []SqlTable

	db, err := sql.Open("sqlite", filepath.ToSlash(path)+"?mode=ro")
	if err != nil {
		return tables
	}
	defer db.Close()

	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
	if err != nil {
		return tables
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		t := SqlTable{Name: name}
		_ = db.QueryRow("SELECT COUNT(*) FROM " + quoteIdent(name)).Scan(&t.Rows)
		tables = append(tables, t)
	}

	return tables
}

func quoteIdent(s string) string {
	return "\"" + strings.ReplaceAll(s, `"`, `""`) + "\""
}

func SqlQuery(dbPath, query string) (map[string]interface{}, error) {
	db, err := sql.Open("sqlite", filepath.ToSlash(dbPath)+"?mode=ro")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var records []map[string]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range cols {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		rec := make(map[string]interface{})
		for i, c := range cols {
			v := vals[i]
			switch t := v.(type) {
			case []byte:
				rec[c] = string(t)
			default:
				rec[c] = v
			}
		}
		records = append(records, rec)
	}

	if len(records) == 0 {
		// 可能是非 SELECT 语句
		return map[string]interface{}{
			"columns": cols,
			"rows":    []map[string]interface{}{},
			"message": "OK (0 rows)",
		}, nil
	}

	return map[string]interface{}{
		"columns": cols,
		"rows":    records,
		"count":   len(records),
	}, nil
}
