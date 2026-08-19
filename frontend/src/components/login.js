export async function login(username, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      username,
      password,
    }),
  });

  let data = {};

  try {
    data = await response.json();
  } catch (e) {
    // 后端可能没有返回 JSON
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "用户名或密码错误"
    );
  }

  return data;
}

export async function checkLogin() {
  try {
    const response = await fetch("/api/hello", {
      method: "GET",
      credentials: "include",
    });

    return response.ok;
  } catch (e) {
    console.error("检查登录状态失败:", e);
    return false;
  }
}

export async function logout() {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });

    return response.ok;
  } catch (e) {
    console.error("[Auth] Logout error:", e);
    return false;
  }
}

export async function changePassword(oldPassword, newPassword) {
  const response = await fetch("/api/user/password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });

  let data = {};

  try {
    data = await response.json();
  } catch (e) {
    // 后端可能没有返回 JSON
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "修改密码失败"
    );
  }

  return data;
}

export default login;
