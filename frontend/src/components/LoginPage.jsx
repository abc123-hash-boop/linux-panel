import React, { useState } from "react";
import { login } from "./login";

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }

    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading(true);

    try {
      await login(username.trim(), password);
      onLogin();
    } catch (err) {
      console.error(err);
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background" />

      <div className="login-card">
        <div className="login-avatar">
          👤
        </div>

        <h1>登录</h1>
        <p className="login-subtitle">登录到服务器管理面板</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              autoComplete="username"
              autoFocus
              disabled={loading}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>

          <div className="login-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "正在登录..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
