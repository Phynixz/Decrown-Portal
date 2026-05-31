function togglePassword() {
  const pass = document.getElementById("password");
  const icon = document.getElementById("eyeIcon");
  if (pass.type === "password") {
    pass.type = "text";
    icon.textContent = "ðŸ™ˆ";
  } else {
    pass.type = "password";
    icon.textContent = "ðŸ‘";
  }
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const error = document.getElementById("error");
  const btn = document.getElementById("loginBtn");

  error.textContent = "";

  if (!email || !password) {
    error.textContent = "Please enter email and password.";
    return;
  }

  btn.textContent = "Logging inâ€¦";
  btn.disabled = true;

  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Login failed");

    const storage = document.getElementById("remember").checked
      ? localStorage
      : sessionStorage;

    storage.setItem("token", "Bearer " + data.token);

    window.location.href = "admin.html";
  } catch (err) {
    error.textContent = err.message;
    document.querySelector(".login-box").classList.add("shake");
    setTimeout(() => document.querySelector(".login-box").classList.remove("shake"), 400);
  } finally {
    btn.textContent = "Login";
    btn.disabled = false;
  }
}

// Allow Enter key to submit
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

