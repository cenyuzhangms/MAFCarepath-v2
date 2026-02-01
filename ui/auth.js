/* ─── CarePath Auth Module ─── */

const AUTH_TOKEN_KEY = "carepath_token";
const AUTH_USER_KEY = "carepath_user";
let switchAuthTab = null;

function renderPreviewTranscript() {
  const chat = document.getElementById("chat-messages");
  if (!chat || chat.children.length > 0) return;
  chat.innerHTML = `
    <div class="message user preview-message">
      <small><span class="preview-label"><span class="preview-icon">👤</span>Demo Patient</span><span class="message-timestamp">Preview</span></small>
      <div>I have chest tightness and shortness of breath since yesterday while walking.</div>
    </div>
    <div class="message assistant preview-message">
      <small><span class="preview-label"><span class="preview-icon">🩺</span>Patient Companion (draft)</span><span class="message-timestamp">Preview</span></small>
      <div>Thanks. A few quick questions: Any chest pain at rest? Any dizziness or fainting?</div>
    </div>
    <div class="message assistant preview-message">
      <small><span class="preview-label"><span class="preview-icon">📋</span>Clinical Triage (draft)</span><span class="message-timestamp">Preview</span></small>
      <div>Potential red flags present. Recommend urgent evaluation today.</div>
    </div>
    <div class="message assistant preview-message">
      <small><span class="preview-label"><span class="preview-icon">🗓️</span>Care Coordination (draft)</span><span class="message-timestamp">Preview</span></small>
      <div>Nearest urgent care has openings. Would you like to schedule a slot?</div>
    </div>
  `;
}

function clearPreviewTranscript() {
  const chat = document.getElementById("chat-messages");
  if (!chat) return;
  const previews = chat.querySelectorAll(".preview-message");
  if (previews.length === 0) return;
  previews.forEach((node) => node.remove());
}

function setPreviewMode(enabled) {
  const appScreen = document.getElementById("app-screen");
  const previewBanner = document.getElementById("preview-banner");
  const previewPill = document.getElementById("preview-pill");
  const logoutBtn = document.getElementById("logout-btn");
  const userPill = document.getElementById("user-pill");
  const newSessionBtn = document.getElementById("new-session");
  if (!appScreen) return;
  appScreen.classList.toggle("preview-mode", enabled);
  previewBanner?.classList.toggle("hidden", !enabled);
  previewPill?.classList.toggle("hidden", !enabled);
  logoutBtn?.classList.toggle("hidden", enabled);
  userPill?.classList.toggle("hidden", enabled);
  if (logoutBtn) {
    logoutBtn.style.display = enabled ? "none" : "";
  }
  if (userPill) {
    userPill.style.display = enabled ? "none" : "";
  }
  if (newSessionBtn) {
    newSessionBtn.disabled = enabled;
    newSessionBtn.classList.toggle("disabled", enabled);
  }
  if (enabled) {
    renderPreviewTranscript();
  } else {
    clearPreviewTranscript();
  }
}

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

/* ─── Screen switching ─── */

function showAuthScreen() {
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  authScreen.classList.remove("hidden");
  authScreen.style.display = "flex";
  appScreen.style.display = "block";
}

function showAppScreen() {
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  authScreen.style.display = "none";
  appScreen.style.display = "block";
  updateUserUI();
}

function openAuthModal(targetTab = "login") {
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  authScreen.classList.remove("hidden");
  authScreen.style.display = "flex";
  appScreen?.classList.remove("hidden");
  appScreen.style.display = "block";
  if (switchAuthTab) switchAuthTab(targetTab);
}

function updateUserUI() {
  const user = getUser();
  const userPill = document.getElementById("user-pill");
  if (userPill && user) {
    userPill.textContent = user.display_name || user.email;
  }
}

/* ─── Auth tab switching ─── */

function initAuthTabs() {
  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  switchAuthTab = (target) => {
    tabs.forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === target);
      t.setAttribute("aria-selected", t.dataset.tab === target ? "true" : "false");
    });
    if (target === "login") {
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
    } else {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
    }
    clearAuthErrors();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      switchAuthTab(target);
    });
  });

  document.querySelectorAll("[data-switch]").forEach((btn) => {
    btn.addEventListener("click", () => switchAuthTab(btn.dataset.switch));
  });
}

/* ─── Error display ─── */

function showAuthError(formId, message) {
  const form = document.getElementById(formId);
  let errorEl = form.querySelector(".auth-error");
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.className = "auth-error";
    errorEl.setAttribute("role", "alert");
    form.prepend(errorEl);
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearAuthErrors() {
  document.querySelectorAll(".auth-error").forEach((el) => el.classList.add("hidden"));
  document.querySelectorAll(".auth-message").forEach((el) => el.classList.add("hidden"));
}

function showAuthMessage(formId, message, type = "success") {
  const form = document.getElementById(formId);
  let msgEl = form.querySelector(".auth-message");
  if (!msgEl) {
    msgEl = document.createElement("div");
    msgEl.className = "auth-message";
    msgEl.setAttribute("role", "status");
    form.prepend(msgEl);
  }
  msgEl.textContent = message;
  msgEl.classList.add(type);
  msgEl.classList.remove("hidden");
}

/* ─── Login ─── */

async function handleLogin(e) {
  e.preventDefault();
  clearAuthErrors();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.querySelector("#login-form button[type=submit]");
  const networkNote = document.getElementById("login-network-note");

  if (!email || !password) {
    showAuthError("login-form", "Please fill in all fields.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Signing in...";
  if (networkNote) networkNote.textContent = "";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error?.message || data.detail?.error?.message || "Login failed.";
      showAuthError("login-form", msg);
      return;
    }

    setAuth(data.access_token, data.user);
    showAuthMessage("login-form", "Signed in. Loading your workspace...", "success");
    showAppScreen();
    setPreviewMode(false);
    await resumeLatestSession();
  } catch (err) {
    showAuthError("login-form", "Network error. Please try again.");
    if (networkNote) {
      networkNote.textContent = "Network error: backend unreachable or blocked.";
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

/* ─── Register ─── */

async function handleRegister(e) {
  e.preventDefault();
  clearAuthErrors();
  const displayName = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const btn = document.querySelector("#register-form button[type=submit]");

  if (!email || !password) {
    showAuthError("register-form", "Email and password are required.");
    return;
  }
  if (password.length < 8) {
    showAuthError("register-form", "Password must be at least 8 characters.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Creating account...";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error?.message || data.detail?.error?.message || "Registration failed.";
      showAuthError("register-form", msg);
      return;
    }

    // Registration success: prompt sign-in instead of auto-login.
    clearAuth();
    document.getElementById("register-form").reset();
    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = "";
    if (typeof switchAuthTab === "function") {
      switchAuthTab("login");
    }
    showAuthMessage("login-form", "Account created. Please sign in to continue.", "success");
  } catch (err) {
    showAuthError("register-form", "Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

async function resumeLatestSession() {
  try {
    const res = await fetch("/api/sessions/latest", {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof window.hydrateSession === "function") {
        window.hydrateSession(data);
      } else if (typeof initApp === "function") {
        initApp();
      }
      if (typeof window.fetchSessions === "function") {
        window.fetchSessions();
      }
      return;
    }
  } catch {}
  if (typeof initApp === "function") initApp();
}

/* ─── Logout ─── */

function logout() {
  clearAuth();
  if (typeof ws !== "undefined" && ws) {
    ws.close();
  }
  if (typeof window.resetSession === "function") {
    window.resetSession();
  }
  showAppScreen();
  setPreviewMode(true);
}

/* ─── Settings Modal ─── */

async function openSettings() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;

  // Fetch fresh data
  const token = getToken();
  if (token) {
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: "Bearer " + token },
      });
      if (res.ok) {
        const user = await res.json();
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else if (res.status === 401) {
        handleTokenExpired();
        return;
      }
    } catch {}
  }

  const user = getUser();
  document.getElementById("settings-name").value = user?.display_name || "";
  document.getElementById("settings-email").value = user?.email || "";
  clearSettingsMessages();
  modal.classList.remove("hidden");
}

function closeSettings() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
}

function clearSettingsMessages() {
  const msg = document.getElementById("settings-message");
  if (msg) {
    msg.textContent = "";
    msg.className = "settings-message";
  }
}

function showSettingsMessage(text, type) {
  const msg = document.getElementById("settings-message");
  if (msg) {
    msg.textContent = text;
    msg.className = `settings-message ${type}`;
  }
}

async function saveSettings(e) {
  e.preventDefault();
  clearSettingsMessages();
  const displayName = document.getElementById("settings-name").value.trim();
  const email = document.getElementById("settings-email").value.trim();
  const btn = document.querySelector("#settings-form button[type=submit]");
  const token = getToken();

  if (!token) {
    handleTokenExpired();
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ display_name: displayName, email }),
    });

    if (res.status === 401) {
      handleTokenExpired();
      return;
    }

    const data = await res.json();

    if (!res.ok || data.error) {
      showSettingsMessage(data.error?.message || "Failed to save settings.", "error");
      return;
    }

    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
    updateUserUI();
    showSettingsMessage("Settings saved successfully.", "success");

    if (typeof showToast === "function") {
      showToast("Settings saved", { icon: "&#10003;" });
    }
  } catch {
    showSettingsMessage("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Changes";
  }
}

/* ─── Token expiry handler ─── */

function handleTokenExpired() {
  clearAuth();
  if (typeof ws !== "undefined" && ws) {
    ws.close();
  }
  if (typeof window.resetSession === "function") {
    window.resetSession();
  }
  showAuthScreen();
  // Show a message on the login form
  setTimeout(() => {
    showAuthError("login-form", "Your session has expired. Please sign in again.");
  }, 100);
}

/* ─── Init ─── */

document.addEventListener("DOMContentLoaded", () => {
  initAuthTabs();

  document.getElementById("login-form")?.addEventListener("submit", handleLogin);
  document.getElementById("register-form")?.addEventListener("submit", handleRegister);
  document.getElementById("settings-form")?.addEventListener("submit", saveSettings);
  document.getElementById("settings-cancel")?.addEventListener("click", closeSettings);
  document.getElementById("settings-btn")?.addEventListener("click", openSettings);
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("preview-sign-in")?.addEventListener("click", () => openAuthModal("login"));
  document.getElementById("preview-create-account")?.addEventListener("click", () => openAuthModal("register"));

  // Close settings on backdrop click
  document.querySelector("#settings-modal .modal-backdrop")?.addEventListener("click", closeSettings);

  // Close settings on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });

  // Check for existing valid token
  const token = getToken();
  if (token) {
    // Verify token is still valid
    fetch("/api/me", { headers: { Authorization: "Bearer " + token } })
      .then((res) => {
        if (res.ok) {
          showAppScreen();
          setPreviewMode(false);
          resumeLatestSession();
        } else {
          clearAuth();
          showAppScreen();
          setPreviewMode(true);
        }
      })
      .catch(() => {
        // Network error — try to use cached token optimistically
        showAppScreen();
        setPreviewMode(false);
        if (typeof initApp === "function") initApp();
      });
  } else {
    showAppScreen();
    setPreviewMode(true);
  }

  // Close auth overlay when clicking outside the card
  document.querySelector("#auth-screen")?.addEventListener("click", (e) => {
    if (e.target?.id === "auth-screen") {
      document.getElementById("auth-screen").classList.add("hidden");
      document.getElementById("auth-screen").style.display = "none";
    }
  });
});
