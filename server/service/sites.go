package service

import (
	"database/sql"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

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
	Name    string `json:"name"`
	Path    string `json:"path"`
	Enabled bool   `json:"enabled"`
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

	// sites-available
	availDir := "/etc/nginx/sites-available"
	enabledDir := "/etc/nginx/sites-enabled"

	entries, _ := os.ReadDir(availDir)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		enabled := false
		if _, err := os.Stat(filepath.Join(enabledDir, name)); err == nil {
			enabled = true
		}
		sites = append(sites, NginxSite{
			Name:    name,
			Path:    filepath.Join(availDir, name),
			Enabled: enabled,
		})
	}

	// conf.d
	confDir := "/etc/nginx/conf.d"
	entries, _ = os.ReadDir(confDir)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".conf") {
			continue
		}
		sites = append(sites, NginxSite{
			Name:    name,
			Path:    filepath.Join(confDir, name),
			Enabled: true,
		})
	}

	return sites
}

func NginxEnableSite(name string) error {
	avail := "/etc/nginx/sites-available"
	enabled := "/etc/nginx/sites-enabled"

	src := filepath.Join(avail, name)
	dst := filepath.Join(enabled, name)

	if _, err := os.Stat(src); err != nil {
		return err
	}

	// 创建 symlink
	if err := os.Symlink(src, dst); err != nil && !os.IsExist(err) {
		return err
	}

	return NginxReload()
}

func NginxReload() error {
	return NginxAction("reload")
}

func NginxDisableSite(name string) error {
	enabled := "/etc/nginx/sites-enabled"
	dst := filepath.Join(enabled, name)

	if _, err := os.Stat(dst); err != nil {
		return err
	}

	if err := os.Remove(dst); err != nil {
		return err
	}

	return NginxReload()
}

func NginxAction(action string) error {
	if !nginxInstalled() {
		return errNginxNotInstalled
	}

	// systemd 优先，fallback 直接调二进制
	cmds := []string{
		"systemctl", action, "nginx",
	}
	if err := exec.Command("systemctl", action, "nginx").Run(); err != nil {
		// fallback: 直接调用 nginx 二进制
		switch action {
		case "start":
			return exec.Command(nginxBin(), "-c", "/etc/nginx/nginx.conf").Run()
		case "stop", "restart", "reload":
			return exec.Command(nginxBin(), "-s", action).Run()
		}
		_ = cmds
	}
	return nil
}

func NginxCreateSite(name, content string) error {
	if name == "" || !strings.HasSuffix(name, ".conf") {
		name = name + ".conf"
	}
	availDir := "/etc/nginx/sites-available"
	enabledDir := "/etc/nginx/sites-enabled"

	// 确保持有目录
	_ = os.MkdirAll(availDir, 0755)
	_ = os.MkdirAll(enabledDir, 0755)

	filePath := filepath.Join(availDir, name)
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return err
	}

	// 自动软链到 sites-enabled
	symlinkPath := filepath.Join(enabledDir, name)
	if _, err := os.Lstat(symlinkPath); err != nil {
		_ = os.Symlink(filePath, symlinkPath)
	}

	// 校验配置
	if out, err := exec.Command(nginxBin(), "-t").CombinedOutput(); err != nil {
		// 配置错误，回滚删除并返回错误
		_ = os.Remove(filePath)
		_ = os.Remove(symlinkPath)
		return errString("nginx config test failed:\n" + string(out))
	}

	return NginxReload()
}

func NginxDeleteSite(name string) error {
	availDir := "/etc/nginx/sites-available"
	enabledDir := "/etc/nginx/sites-enabled"

	avail := filepath.Join(availDir, name)
	enabled := filepath.Join(enabledDir, name)

	if _, err := os.Stat(avail); err != nil {
		alt := filepath.Join("/etc/nginx/conf.d", name)
		if _, err2 := os.Stat(alt); err2 == nil {
			if err := os.Remove(alt); err != nil {
				return err
			}
		} else {
			return err
		}
	} else {
		if err := os.Remove(avail); err != nil {
			return err
		}
	}

	if _, err := os.Lstat(enabled); err == nil {
		_ = os.Remove(enabled)
	}

	return NginxReload()
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
	Name    string `json:"name"`
	Rows    int64  `json:"rows"`
}

type SqlDB struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
	Tables []SqlTable `json:"tables"`
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
			"columns":  cols,
			"rows":     []map[string]interface{}{},
			"message":  "OK (0 rows)",
		}, nil
	}

	return map[string]interface{}{
		"columns": cols,
		"rows":    records,
		"count":   len(records),
	}, nil
}
