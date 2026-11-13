package service

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDescribeNginxSiteKinds(t *testing.T) {
	cases := []struct {
		name string
		body string
		kind string
		ssl  bool
	}{
		{"static", "server { listen 80; server_name static.example.test www.static.example.test; root /var/www/static; }", "static", false},
		{"php", "server { listen 443 ssl; server_name php.example.test; root /var/www/php; location ~ php$ { fastcgi_pass unix:/run/php/php-fpm.sock; } }", "php", true},
		{"proxy", "server { listen 80; server_name proxy.example.test; location / { proxy_pass http://127.0.0.1:3000; } }", "proxy", false},
		{"loadbalance", "upstream app_pool { server 127.0.0.1:3000; server 127.0.0.1:3001; } server { listen 80; server_name lb.example.test; location / { proxy_pass http://app_pool; } }", "loadbalance", false},
		{"redirect", "server { listen 80; server_name old.example.test; return 301 https://new.example.test$request_uri; }", "redirect", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "site.conf")
			if err := os.WriteFile(path, []byte(tc.body), 0600); err != nil {
				t.Fatal(err)
			}
			site := NginxSite{Path: path}
			describeNginxSite(&site)
			if site.Kind != tc.kind {
				t.Fatalf("kind = %q, want %q", site.Kind, tc.kind)
			}
			if site.SSL != tc.ssl {
				t.Fatalf("ssl = %v, want %v", site.SSL, tc.ssl)
			}
			if site.Domains == "" {
				t.Fatal("expected discovered server_name")
			}
		})
	}
}

func TestNginxSiteNameValidationPattern(t *testing.T) {
	for _, name := range []string{"example.com.conf", "my-site.conf", "site_01.conf"} {
		if !siteNameRE.MatchString(name) {
			t.Errorf("expected valid site name %q", name)
		}
	}
	for _, name := range []string{"../site.conf", "site", "site;rm.conf", "site name.conf"} {
		if siteNameRE.MatchString(name) {
			t.Errorf("expected invalid site name %q", name)
		}
	}
}
