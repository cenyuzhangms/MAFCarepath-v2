/* ─── Agent role icons (inline SVG) ─── */
const agentIcons = {
  patient_companion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  clinical_triage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a2 2 0 002 2h1a2 2 0 002-2V4a2 2 0 00-2-2"/><path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
  diagnostics_orders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.55a1 1 0 00.9 1.45h12.76a1 1 0 00.9-1.45l-5.069-10.127A2 2 0 0114 9.527V2"/><path d="M8.5 2h7"/></svg>`,
  coverage_prior_auth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  care_coordination: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
};

const workflowStages = [
  {
    id: "patient_companion",
    label: "Patient Companion",
    subtitle: "Intake + check-ins",
    icon: "PC",
    color: "#2563eb",
    avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='16' fill='%23e0ecff'/><circle cx='40' cy='30' r='14' fill='%23638bff'/><rect x='18' y='46' width='44' height='20' rx='10' fill='%23638bff'/></svg>",
  },
  {
    id: "clinical_triage",
    label: "Clinical Triage",
    subtitle: "Urgency + signoff",
    icon: "CT",
    color: "#0f766e",
    avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='16' fill='%23e6f5f2'/><circle cx='40' cy='30' r='14' fill='%230f766e'/><rect x='18' y='46' width='44' height='20' rx='10' fill='%230f766e'/><rect x='36' y='18' width='8' height='24' fill='%23ffffff'/><rect x='28' y='26' width='24' height='8' fill='%23ffffff'/></svg>",
  },
  {
    id: "diagnostics_orders",
    label: "Diagnostics & Orders",
    subtitle: "SBAR + orders",
    icon: "DO",
    color: "#dc2626",
    avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='16' fill='%23fde8e8'/><rect x='20' y='16' width='40' height='48' rx='8' fill='%23dc2626'/><rect x='30' y='24' width='20' height='6' fill='%23fff'/><rect x='30' y='36' width='20' height='6' fill='%23fff'/><rect x='30' y='48' width='14' height='6' fill='%23fff'/></svg>",
  },
  {
    id: "coverage_prior_auth",
    label: "Coverage & Prior Auth",
    subtitle: "Payer constraints",
    icon: "PA",
    color: "#16a34a",
    avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='16' fill='%23e8f7ee'/><path d='M40 16l22 10v14c0 14-10 24-22 30-12-6-22-16-22-30V26z' fill='%2316a34a'/><path d='M30 40l8 8 14-16' stroke='%23fff' stroke-width='6' fill='none' stroke-linecap='round'/></svg>",
  },
  {
    id: "care_coordination",
    label: "Care Coordination",
    subtitle: "Scheduling + monitoring",
    icon: "CC",
    color: "#1d4ed8",
    avatar: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='16' fill='%23e6f0ff'/><rect x='18' y='18' width='44' height='44' rx='10' fill='%231d4ed8'/><path d='M30 32h20v4H30zM30 42h20v4H30z' fill='%23fff'/></svg>",
  },
];

const backendUrl =
  window.localStorage.getItem("healthcare_backend") ||
  (window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:7000");
const wsUrl = backendUrl.replace("http://", "ws://").replace("https://", "wss://") + "/ws/chat";

const agentList = document.getElementById("agent-list");
const handoffList = document.getElementById("handoff-list");
const flowStrip = document.getElementById("flow-strip-track");
const sessionPill = document.getElementById("session-pill");
const riskPill = document.getElementById("risk-pill");
const riskSummary = document.getElementById("risk-summary");
const sbarBackground = document.getElementById("sbar-background");
const sbarRecommendation = document.getElementById("sbar-recommendation");
const orderList = document.getElementById("order-list");
const timeline = document.getElementById("timeline");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send");
const input = document.getElementById("chat-input");
const newSessionButton = document.getElementById("new-session");
const exportButton = document.getElementById("export-btn");
const shareButton = document.getElementById("share-btn");
const notifyButton = document.getElementById("notify-btn");
const moreButton = document.getElementById("more-btn");
const toast = document.getElementById("toast");
const patternOptions = document.getElementById("pattern-options");
const aboutButton = document.getElementById("about-btn");
const aboutFooterLink = document.getElementById("about-footer-link");
const aboutModal = document.getElementById("about-modal");
const aboutBackdrop = document.querySelector("#about-modal .modal-backdrop");
const flowStripContainer = document.querySelector(".flow-strip");
const themeToggle = document.getElementById("theme-toggle");
const fontToggle = document.getElementById("font-toggle");
const scrollToBottomBtn = document.getElementById("scroll-to-bottom");
const mobileTabBar = document.getElementById("mobile-tab-bar");
const sidebarLeft = document.getElementById("sidebar-left");
const sidebarRight = document.getElementById("sidebar-right");
const sendHint = document.getElementById("send-hint");
const sendHintSignIn = document.getElementById("send-hint-signin");
const sendHintCreate = document.getElementById("send-hint-create");
const sessionList = document.getElementById("session-list");
const sessionModal = document.getElementById("session-modal");
const sessionModalList = document.getElementById("session-modal-list");
const sessionNewBtn = document.getElementById("session-new-btn");
const sessionResumeBtn = document.getElementById("session-resume-btn");
// memory summary panel removed; use drawer only
const memoryPill = document.getElementById("memory-pill");
const memoryToggle = document.getElementById("memory-toggle");
const memoryDrawer = document.getElementById("memory-drawer");
const memoryDrawerBody = document.getElementById("memory-drawer-body");
const memoryClose = document.getElementById("memory-close");

let sessionId = crypto.randomUUID();
let agentState = {};
let currentAgents = new Set();
let notificationsEnabled = true;
let toastTimer = null;
const conversationLog = [];
let lastMobileTab = "chat";
let suppressPersist = false;

/* ─── Dark Mode ─── */
function initTheme() {
  const saved = localStorage.getItem("carepath-theme");
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("carepath-theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("carepath-theme", "dark");
  }
}

initTheme();
themeToggle?.addEventListener("click", toggleTheme);

function initFontSize() {
  const saved = localStorage.getItem("carepath-font");
  if (saved === "large") {
    document.documentElement.setAttribute("data-font", "large");
    fontToggle?.classList.add("active");
  }
}

function toggleFontSize() {
  const isLarge = document.documentElement.getAttribute("data-font") === "large";
  if (isLarge) {
    document.documentElement.removeAttribute("data-font");
    localStorage.setItem("carepath-font", "normal");
    fontToggle?.classList.remove("active");
  } else {
    document.documentElement.setAttribute("data-font", "large");
    localStorage.setItem("carepath-font", "large");
    fontToggle?.classList.add("active");
  }
}

initFontSize();
fontToggle?.addEventListener("click", toggleFontSize);

/* ─── Mobile Tab Navigation ─── */
function setMobileTab(tab) {
  if (!mobileTabBar) return;
  lastMobileTab = tab;
  mobileTabBar.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  if (tab === "chat") {
    sidebarLeft?.classList.add("mobile-hidden");
    sidebarRight?.classList.add("mobile-hidden");
  } else if (tab === "team") {
    sidebarLeft?.classList.remove("mobile-hidden");
    sidebarRight?.classList.add("mobile-hidden");
  } else if (tab === "artifacts") {
    sidebarLeft?.classList.add("mobile-hidden");
    sidebarRight?.classList.remove("mobile-hidden");
  }
}

mobileTabBar?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (btn) setMobileTab(btn.dataset.tab);
});

// Default: hide sidebars on mobile
if (window.innerWidth <= 1000) {
  setMobileTab("chat");
}
window.addEventListener("resize", () => {
  if (window.innerWidth <= 1000) {
    setMobileTab(lastMobileTab);
  } else {
    sidebarLeft?.classList.remove("mobile-hidden");
    sidebarRight?.classList.remove("mobile-hidden");
  }
});

/* ─── Timestamp helper ─── */
function formatTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ─── Typing Indicator ─── */
let typingEl = null;

function showTypingIndicator(agentName, count = 1) {
  removeTypingIndicator();
  typingEl = document.createElement("div");
  typingEl.className = "typing-indicator";
  const label =
    count > 1 ? "Multiple agents are processing..." : `${agentName || "Agent"} is processing...`;
  typingEl.innerHTML = `
    <div class="typing-dots">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
    <span class="typing-label">${label}</span>
  `;
  chatMessages.appendChild(typingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  if (typingEl && typingEl.parentNode) {
    typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }
}

/* ─── Scroll-to-bottom ─── */
function updateScrollButton() {
  if (!chatMessages || !scrollToBottomBtn) return;
  const threshold = 100;
  const isScrolledUp = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight > threshold;
  scrollToBottomBtn.classList.toggle("visible", isScrolledUp);
}

chatMessages?.addEventListener("scroll", updateScrollButton);
scrollToBottomBtn?.addEventListener("click", () => {
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

/* ─── Skeleton Loader ─── */
function showSkeleton() {
  if (chatMessages.querySelector(".message") || chatMessages.querySelector(".assistant-structured")) {
    return;
  }
  if (chatMessages.querySelector(".skeleton-card")) {
    return;
  }
  chatMessages.insertAdjacentHTML(
    "afterbegin",
    `
    <div class="skeleton-card skeleton">
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short"></div>
    </div>
  `
  );
}

function removeSkeleton() {
  const skeleton = chatMessages.querySelector(".skeleton-card");
  if (skeleton) skeleton.remove();
}

/* ─── Render Stages ─── */
function renderStages() {
  agentList.innerHTML = "";
  flowStrip.innerHTML = "";
  workflowStages.forEach((stage) => {
    const status = getStageStatus(stage.id);
    const preview = getStagePreview(stage.id);

    const card = document.createElement("div");
    card.className = "agent-card";
    card.setAttribute("role", "listitem");

    const avatar = document.createElement("div");
    avatar.className = "agent-avatar";
    avatar.style.background = `${stage.color}18`;
    avatar.style.color = stage.color;
    // Use role-specific SVG icon instead of generic avatar
    if (agentIcons[stage.id]) {
      avatar.innerHTML = agentIcons[stage.id];
    } else {
      const avatarImg = document.createElement("img");
      avatarImg.src = stage.avatar;
      avatarImg.alt = stage.label;
      avatar.appendChild(avatarImg);
    }

    const meta = document.createElement("div");
    meta.className = "agent-meta";
    const title = document.createElement("h4");
    title.textContent = stage.label;
    const subtitle = document.createElement("p");
    subtitle.textContent = preview || stage.subtitle;
    meta.appendChild(title);
    meta.appendChild(subtitle);

    const statusEl = document.createElement("div");
    statusEl.className = `agent-status ${status}`;
    statusEl.textContent = status === "active" ? "Running" : status === "complete" ? "Complete" : "Idle";
    statusEl.setAttribute("aria-label", `${stage.label} status: ${statusEl.textContent}`);

    card.appendChild(avatar);
    card.appendChild(meta);
    card.appendChild(statusEl);
    agentList.appendChild(card);
  });

  renderFlowDiagram(getSelectedPattern());
}

function renderFlowDiagram(pattern) {
  const canvas = document.createElement("div");
  canvas.className = "flow-canvas";

  const intake = makeFlowNode("patient_companion", "Patient Companion");
  const triage = makeFlowNode("clinical_triage", "Clinical Triage");
  const diagnostics = makeFlowNode("diagnostics_orders", "Diagnostics & Orders");
  const coverage = makeFlowNode("coverage_prior_auth", "Coverage & Prior Auth");
  const coordination = makeFlowNode("care_coordination", "Care Coordination");

  let legendText = "";
  if (pattern === "fanout_fanin") {
    canvas.appendChild(flowRow([intake, arrow(), triage]));
    canvas.appendChild(flowRow([splitBlock("Fan-out"), branch([diagnostics, coverage, coordination])]));
    canvas.appendChild(flowRow([mergeBlock("Fan-in"), coordination]));
    legendText = "Fan-out runs diagnostics, coverage, and coordination in parallel, then fan-in refines the final plan.";
  } else if (pattern === "handoff") {
    canvas.appendChild(flowRow([intake, arrow(), triage, arrow(), diagnostics, arrow(), coverage, arrow(), coordination]));
    canvas.appendChild(handoffLoop(diagnostics, triage, "review loop"));
    canvas.appendChild(handoffLoop(coverage, diagnostics, "addendum loop"));
    canvas.appendChild(handoffLoop(coordination, intake, "follow-up"));
    legendText =
      "Review loop: Triage re-checks urgency after orders. Addendum loop: Coverage asks Diagnostics for docs. Follow-up: Coordination returns to Patient Companion.";
  } else {
    canvas.appendChild(flowRow([intake, arrow(), triage, arrow(), diagnostics, arrow(), coverage, arrow(), coordination]));
  }

  flowStrip.appendChild(canvas);
  if (legendText) {
    const legend = document.createElement("div");
    legend.className = "flow-legend";
    legend.textContent = legendText;
    flowStrip.appendChild(legend);
  }
}

function makeFlowNode(stageId, label) {
  const stage = workflowStages.find((s) => s.id === stageId) || {
    icon: "MG",
    color: "#64748b",
    subtitle: "",
  };
  const status = getStageStatus(stageId);
  const node = document.createElement("div");
  node.className = `flow-node ${status}`;
  node.style.setProperty("--stage-color", stage.color);
  const icon = document.createElement("div");
  icon.className = "flow-icon";
  icon.textContent = stage.icon || "MG";
  const title = document.createElement("h3");
  title.textContent = label;
  const subtitle = document.createElement("p");
  subtitle.textContent = stage.subtitle || "";
  node.appendChild(icon);
  node.appendChild(title);
  node.appendChild(subtitle);
  return node;
}

function arrow() {
  const el = document.createElement("div");
  el.className = "flow-arrow";
  return el;
}

function forkIcon() {
  const el = document.createElement("div");
  el.className = "flow-fork";
  return el;
}

function mergeIcon() {
  const el = document.createElement("div");
  el.className = "flow-merge";
  return el;
}

function forkLabel(text) {
  const el = document.createElement("div");
  el.className = "flow-label";
  el.textContent = text;
  return el;
}

function mergeLabel(text) {
  const el = document.createElement("div");
  el.className = "flow-label";
  el.textContent = text;
  return el;
}

function branch(nodes) {
  const el = document.createElement("div");
  el.className = "flow-branch";
  nodes.forEach((node) => el.appendChild(node));
  return el;
}

function flowRow(nodes) {
  const row = document.createElement("div");
  row.className = "flow-row";
  nodes.forEach((node) => row.appendChild(node));
  return row;
}

function splitBlock(labelText) {
  const block = document.createElement("div");
  block.className = "flow-split";
  block.appendChild(forkIcon());
  block.appendChild(forkLabel(labelText));
  return block;
}

function mergeBlock(labelText) {
  const block = document.createElement("div");
  block.className = "flow-merge-block";
  block.appendChild(mergeIcon());
  block.appendChild(mergeLabel(labelText));
  return block;
}

function handoffLoop(fromNode, toNode, labelText) {
  const row = document.createElement("div");
  row.className = "flow-row";
  row.appendChild(fromNode.cloneNode(true));
  row.appendChild(curveArrow(labelText));
  row.appendChild(toNode.cloneNode(true));
  return row;
}

function curveArrow(labelText) {
  const wrapper = document.createElement("div");
  wrapper.className = "flow-split";
  const arrowEl = document.createElement("div");
  arrowEl.className = "flow-curve";
  const label = document.createElement("div");
  label.className = "flow-label";
  label.textContent = labelText;
  wrapper.appendChild(arrowEl);
  wrapper.appendChild(label);
  return wrapper;
}

function getStageStatus(stageId) {
  if (currentAgents.has(stageId)) return "active";
  if (agentState[stageId]?.complete) return "complete";
  return "pending";
}

function getStagePreview(stageId) {
  const msg = agentState[stageId]?.finalMessage || "";
  if (!msg) return "";
  const cleaned = msg
    .replace(/```[\s\S]*?```/g, "")
    .replace(/###\s+/g, "")
    .replace(/\{|\}|\[|\]/g, "")
    .trim();
  return cleaned.length > 120 ? cleaned.slice(0, 120) + "..." : cleaned;
}

function appendTimeline(kind, content) {
  const item = document.createElement("div");
  item.className = "handoff-item";
  const meta = document.createElement("small");
  meta.textContent = `${kind} · ${formatTimestamp()}`;
  const body = document.createElement("div");
  body.textContent = content;
  item.appendChild(meta);
  item.appendChild(body);
  handoffList.prepend(item);
  if (!suppressPersist) {
    persistEvent("handoff", { kind, content });
  }
}

function appendMessage(role, content) {
  removeSkeleton();
  removeTypingIndicator();
  const shouldStickToBottom =
    chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 120;
  const item = document.createElement("div");
  item.className = `message ${role}`;
  const meta = document.createElement("small");
  const roleLabel = document.createElement("span");
  roleLabel.textContent = `${role === "user" ? "You" : role === "error" ? "Error" : "Assistant"}`;
  const timestamp = document.createElement("span");
  timestamp.className = "message-timestamp";
  timestamp.textContent = formatTimestamp();
  meta.appendChild(roleLabel);
  meta.appendChild(timestamp);
  const body = document.createElement("div");
  body.innerHTML = role === "assistant" ? formatAssistantMessage(content) : formatMessage(content);
  item.appendChild(meta);
  item.appendChild(body);
  chatMessages.appendChild(item);
  if (shouldStickToBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  updateScrollButton();
  if (!suppressPersist) {
    persistEvent("message", { role, content });
  }
}

function formatMessage(text) {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  let html = "";
  let inList = false;

  const flushList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      html += "<br />";
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      html += `<h4>${line.replace("### ", "")}</h4>`;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${line.slice(2)}</li>`;
      continue;
    }

    flushList();
    html += `<p>${line}</p>`;
  }

  flushList();

  return html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

function formatAssistantMessage(text) {
  const sections = parseSections(text || "");
  if (!sections.length) {
    return formatMessage(text);
  }

  const iconMap = {
    Summary: "SUM",
    "Safety Disclaimer": "SAFE",
    "Immediate Next Steps": "NEXT",
    "Questions For You": "Q",
    "What We've Prepared": "PREP",
    "When To Re-Contact": "TIME",
  };

  let html = '<div class="assistant-structured">';
  for (const section of sections) {
    html += `
      <div class="section-card">
        <div class="section-header">
          <span class="section-icon">${iconMap[section.title] || "&#10003;"}</span>
          <h4>${section.title}</h4>
        </div>
        ${renderSectionBody(section.body)}
      </div>
    `;
  }
  html += "</div>";
  return html;
}

function parseSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("### ")) {
      if (current) sections.push(current);
      current = { title: line.replace("### ", ""), body: [] };
      continue;
    }
    if (!current) continue;
    current.body.push(rawLine);
  }
  if (current) sections.push(current);
  return sections;
}

function renderSectionBody(lines) {
  const cleaned = lines.join("\n").trim();
  if (!cleaned) return "";
  const html = formatMessage(cleaned);
  return `<div class="section-body">${html}</div>`;
}

async function resetSession() {
  sessionId = crypto.randomUUID();
  agentState = {};
  currentAgents = new Set();
  handoffList.innerHTML = "";
  chatMessages.innerHTML = "";
  conversationLog.length = 0;
  resetArtifacts();
  updateSessionPill();
  renderStages();
  if (typeof getToken === "function" && getToken()) {
    const remote = await createRemoteSession();
    if (remote?.id) {
      sessionId = remote.id;
      updateSessionPill();
    }
    connectWebSocket();
  } else {
    if (typeof setPreviewMode === "function") {
      setPreviewMode(true);
    }
  }
}

let ws;
function getSelectedPattern() {
  const active = patternOptions?.querySelector(".pattern-btn.active");
  return active?.dataset?.pattern || "sequential";
}

function setActivePattern(pattern) {
  if (!patternOptions) return;
  patternOptions.querySelectorAll(".pattern-btn").forEach((btn) => {
    const isActive = btn.dataset.pattern === pattern;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", isActive ? "true" : "false");
  });
}

function connectWebSocket() {
  if (typeof getToken === "function" && !getToken()) {
    return;
  }
  if (ws) ws.close();
  showSkeleton();
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    removeSkeleton();
    ws.send(JSON.stringify({ session_id: sessionId, access_token: getToken(), pattern: getSelectedPattern() }));
  };
  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    handleEvent(payload);
  };
  ws.onclose = (event) => {
    // Don't reconnect if closed due to auth failure (1008)
    if (event.code === 1008) return;
    if (typeof getToken === "function" && !getToken()) return;
    setTimeout(connectWebSocket, 1500);
  };
}

function handleEvent(event) {
  switch (event.type) {
    case "orchestrator":
      appendTimeline(event.kind || "info", event.content || "");
      updateRiskFromText(event.content || "");
      break;
    case "agent_start":
      currentAgents.add(event.agent_id);
      if (!agentState[event.agent_id]) {
        agentState[event.agent_id] = { name: event.agent_name || event.agent_id, tokens: [] };
      }
      showTypingIndicator(event.agent_name || event.agent_id, currentAgents.size);
      renderStages();
      break;
    case "agent_token":
      if (agentState[event.agent_id]) {
        agentState[event.agent_id].tokens.push(event.content || "");
      }
      break;
    case "agent_message":
      currentAgents.delete(event.agent_id);
      if (!agentState[event.agent_id]) agentState[event.agent_id] = {};
      agentState[event.agent_id].finalMessage = event.content || "";
      agentState[event.agent_id].complete = true;
      if (event.agent_id === "diagnostics_orders") {
        updateArtifacts(event.content || "");
      }
      removeTypingIndicator();
      // Show typing for next agent if any are still active
      if (currentAgents.size > 0) {
        const nextId = [...currentAgents][0];
        const nextAgent = agentState[nextId];
        showTypingIndicator(nextAgent?.name || nextId, currentAgents.size);
      }
      renderStages();
      updateRiskFromText(event.content || "");
      break;
    case "tool_called":
      appendTimeline("tool", `${event.agent_id}: ${event.tool_name}`);
      break;
    case "final_result":
      removeTypingIndicator();
      if (event.content) appendMessage("assistant", event.content);
      if (event.content) conversationLog.push({ role: "assistant", content: event.content });
      break;
    case "error":
      removeTypingIndicator();
      if (event.message) appendMessage("error", event.message);
      break;
    case "auth_error":
      removeTypingIndicator();
      if (typeof handleTokenExpired === "function") handleTokenExpired();
      break;
    default:
      break;
  }
}

function sendMessage() {
  const text = input.value.trim();
  if (typeof getToken === "function" && !getToken()) {
    if (sendHint) {
      sendHint.classList.remove("hidden");
    }
    return;
  }
  if (!text) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket();
    if (typeof showToast === "function") {
      showToast("Connecting to session. Please try again.", { icon: "🔄" });
    }
    return;
  }
  appendMessage("user", text);
  conversationLog.push({ role: "user", content: text });
  ws.send(
    JSON.stringify({
      session_id: sessionId,
      prompt: text,
      access_token: getToken(),
      pattern: getSelectedPattern(),
    })
  );
  input.value = "";
}

function updateSessionPill() {
  sessionPill.textContent = `Session · ${sessionId.slice(0, 8)}`;
}

function renderSessionList(items) {
  if (!sessionList) return;
  sessionList.innerHTML = "";
  if (!items || items.length === 0) {
    sessionList.innerHTML = '<div class="session-item"><small>No sessions yet.</small></div>';
    return;
  }
  items.forEach((s, idx) => {
    const el = document.createElement("div");
    el.className = "session-item";
    el.innerHTML = `
      <strong>${s.title || "Session"} · ${s.id.slice(0, 6)}</strong>
      <small>${s.updated_at || ""}</small>
      <div class="session-preview">${s.summary || "No summary yet."}</div>
    `;
    el.addEventListener("click", () => loadSessionById(s.id));
    sessionList.appendChild(el);
  });
}

async function fetchSessions() {
  if (typeof getToken !== "function" || !getToken()) return [];
  try {
    const res = await fetch("/api/sessions", {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    renderSessionList(data.sessions || []);
    showSessionModal(data.sessions || []);
    return data.sessions || [];
  } catch {
    return [];
  }
}

async function loadSessionById(id) {
  if (typeof getToken !== "function" || !getToken()) return;
  try {
    const res = await fetch(`/api/sessions/${id}`, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof hydrateSession === "function") {
        hydrateSession(data);
      }
    }
  } catch {
    // ignore
  }
}

async function createRemoteSession() {
  if (typeof getToken !== "function" || !getToken()) return null;
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ title: "" }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function persistEvent(eventType, payload) {
  if (typeof getToken !== "function" || !getToken()) return;
  try {
    await fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ event_type: eventType, payload }),
    });
  } catch {
    // ignore persistence failures in demo
  }
}

function hydrateSession(data) {
  if (!data || !data.session) return;
  suppressPersist = true;
  sessionId = data.session.id;
  agentState = {};
  currentAgents = new Set();
  handoffList.innerHTML = "";
  chatMessages.innerHTML = "";
  conversationLog.length = 0;
  resetArtifacts();
  updateSessionPill();

  (data.messages || []).forEach((msg) => {
    appendMessage(msg.role || "assistant", msg.content || "");
    conversationLog.push({ role: msg.role || "assistant", content: msg.content || "" });
  });

  (data.handoffs || []).forEach((item) => {
    appendTimeline(item.kind || "info", item.content || "");
  });

  (data.artifacts || []).forEach((art) => {
    try {
      const parsed = JSON.parse(art.payload_json || "{}");
      updateArtifacts(JSON.stringify(parsed));
    } catch {
      // ignore
    }
  });

  renderStages();
  if (memoryDrawerBody && data.session.summary) {
    memoryDrawerBody.textContent = data.session.summary;
    memoryPill?.classList.remove("hidden");
  }
  suppressPersist = false;
}

function updateRiskFromText(text) {
  const lowered = text.toLowerCase();
  if (lowered.includes("high")) {
    riskPill.textContent = "Risk: HIGH";
    riskPill.classList.add("danger");
    riskSummary.textContent = "High risk flagged in triage";
    return;
  }
  if (lowered.includes("urgent") || lowered.includes("emergent")) {
    riskPill.textContent = "Risk: URGENT";
    riskPill.classList.add("danger");
    riskSummary.textContent = "Urgent escalation recommended";
  }
}

function updateArtifacts(messageText) {
  const json = extractJson(messageText);
  if (!json) return;

  document.getElementById("artifact-empty").classList.add("hidden");
  document.getElementById("artifact-sbar").classList.remove("hidden");
  document.getElementById("artifact-orders").classList.remove("hidden");

  if (json.sbar_note && sbarBackground) {
    sbarBackground.textContent = truncate(json.sbar_note, 80);
  }

  if (json.order_bundle && sbarRecommendation) {
    sbarRecommendation.textContent = "Drafted orders + SBAR handoff ready";
  }

  if (json.order_bundle && orderList) {
    orderList.innerHTML = "";
    const items = [
      ...(json.order_bundle.labs || []),
      ...(json.order_bundle.cultures || []),
      ...(json.order_bundle.imaging || []),
    ];
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "artifact-item";
      const name = document.createElement("span");
      name.textContent = item;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = "30-60 min";
      row.appendChild(name);
      row.appendChild(meta);
      orderList.appendChild(row);
    });
  }
  if (!suppressPersist) {
    persistEvent("artifact", { artifact_type: "diagnostics", data: json });
  }
}

function extractJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    return null;
  }
}

function truncate(text, maxLen) {
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function resetArtifacts() {
  document.getElementById("artifact-empty").classList.remove("hidden");
  document.getElementById("artifact-sbar").classList.add("hidden");
  document.getElementById("artifact-orders").classList.add("hidden");
  if (orderList) {
    orderList.innerHTML = "";
  }
  if (sbarBackground) sbarBackground.textContent = "Recent labs & symptoms summarized";
  if (sbarRecommendation) sbarRecommendation.textContent = "Drafted orders + handoff note";
  if (riskSummary) riskSummary.textContent = "Risk level pending";
}

/* ─── Toast (improved with persistent option) ─── */
function showToast(message, { icon = "", persistent = false } = {}) {
  if (!toast) return;
  if (toastTimer) clearTimeout(toastTimer);

  let html = "";
  if (icon) html += `<span class="toast-icon">${icon}</span>`;
  html += `<span>${message}</span>`;
  if (persistent) {
    html += `<button class="toast-close" aria-label="Dismiss">&times;</button>`;
    toast.classList.add("persistent");
  } else {
    toast.classList.remove("persistent");
  }

  toast.innerHTML = html;
  toast.classList.remove("hidden");

  if (persistent) {
    toast.querySelector(".toast-close")?.addEventListener("click", () => {
      toast.classList.add("hidden");
    });
  } else {
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
  }
}

/* ─── Artifact action buttons with loading/success states ─── */
document.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const originalText = actionBtn.textContent;

  actionBtn.classList.add("loading");

  setTimeout(() => {
    actionBtn.classList.remove("loading");
    actionBtn.classList.add("success");
    actionBtn.textContent = "Done";

    if (action === "ehr") {
      showToast("SBAR sent to EHR", { icon: "&#10003;", persistent: true });
    } else if (action === "pdf") {
      showToast("PDF exported", { icon: "&#128196;" });
    } else if (action === "copy") {
      showToast("Copied to clipboard", { icon: "&#128203;" });
    } else if (action === "view-details") {
      showToast("Order details loaded", { icon: "&#128203;" });
    } else {
      showToast(`${action} completed`, { icon: "&#10003;" });
    }

    setTimeout(() => {
      actionBtn.classList.remove("success");
      actionBtn.textContent = originalText;
    }, 1500);
  }, 800);
});

exportButton?.addEventListener("click", () => {
  const payload = {
    sessionId,
    conversation: conversationLog,
    agents: agentState,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `carepath-session-${sessionId.slice(0, 8)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Exported session data", { icon: "&#128190;" });
});

shareButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Share link copied", { icon: "&#128279;" });
  } catch (err) {
    showToast("Unable to copy link");
  }
});

notifyButton?.addEventListener("click", () => {
  notificationsEnabled = !notificationsEnabled;
  notifyButton.classList.toggle("active", notificationsEnabled);
  showToast(notificationsEnabled ? "Notifications on" : "Notifications off", { icon: notificationsEnabled ? "&#128276;" : "&#128277;" });
});

moreButton?.addEventListener("click", () => {
  showToast("More actions coming soon");
});

function openAbout() {
  if (!aboutModal) return;
  aboutModal.classList.remove("hidden");
}

function closeAbout() {
  if (!aboutModal) return;
  aboutModal.classList.add("hidden");
}

aboutButton?.addEventListener("click", openAbout);
aboutFooterLink?.addEventListener("click", (event) => {
  event.preventDefault();
  openAbout();
});
aboutBackdrop?.addEventListener("click", closeAbout);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAbout();
});

sendButton.addEventListener("click", sendMessage);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
newSessionButton.addEventListener("click", async () => {
  await resetSession();
  if (typeof showToast === "function") {
    showToast("Started a fresh session", { icon: "✨" });
  }
});
patternOptions?.addEventListener("click", (event) => {
  const button = event.target.closest(".pattern-btn");
  if (!button) return;
  const pattern = button.dataset.pattern;
  setActivePattern(pattern);
  renderStages();
  showToast(`Pattern set to ${button.textContent.trim()}`, { icon: "&#9881;" });
});

sendHintSignIn?.addEventListener("click", () => {
  if (sendHint) sendHint.classList.add("hidden");
  if (typeof openAuthModal === "function") openAuthModal("login");
});

sendHintCreate?.addEventListener("click", () => {
  if (sendHint) sendHint.classList.add("hidden");
  if (typeof openAuthModal === "function") openAuthModal("register");
});

document.addEventListener("click", (event) => {
  if (!sendHint || sendHint.classList.contains("hidden")) return;
  const isInside = sendHint.contains(event.target) || sendButton.contains(event.target);
  if (!isInside) {
    sendHint.classList.add("hidden");
  }
});

memoryToggle?.addEventListener("click", () => {
  memoryDrawer?.classList.remove("hidden");
});
memoryClose?.addEventListener("click", () => {
  memoryDrawer?.classList.add("hidden");
});
document.querySelector("#memory-drawer .drawer-backdrop")?.addEventListener("click", () => {
  memoryDrawer?.classList.add("hidden");
});

let lastScrollTop = 0;
chatMessages?.addEventListener("scroll", () => {
  const current = chatMessages.scrollTop;
  const delta = current - lastScrollTop;
  if (Math.abs(delta) < 8) return;
  if (delta > 0) {
    flowStripContainer?.classList.add("collapsed");
  } else {
    flowStripContainer?.classList.remove("collapsed");
  }
  lastScrollTop = current;
});

/* ─── App Init (called by auth.js after login) ─── */
function initApp() {
  setActivePattern("sequential");
  resetSession();
  fetchSessions();
}

// Allow auth module to reset UI on logout
window.resetSession = resetSession;
window.hydrateSession = hydrateSession;
window.fetchSessions = fetchSessions;
function showSessionModal(sessions) {
  if (!sessionModal || !sessionModalList) return;
  sessionModalList.innerHTML = "";
  if (sessions && sessions.length) {
    sessions.slice(0, 5).forEach((s) => {
      const el = document.createElement("div");
      el.className = "session-item";
      el.innerHTML = `<strong>${s.title || "Session"} · ${s.id.slice(0, 6)}</strong><small>${s.updated_at || ""}</small>`;
      el.addEventListener("click", () => {
        if (typeof hydrateSession === "function") {
          fetch(`/api/sessions/${s.id}`, {
            headers: { Authorization: "Bearer " + getToken() },
          })
            .then((r) => r.json())
            .then((data) => hydrateSession(data));
        }
        sessionModal.classList.add("hidden");
      });
      sessionModalList.appendChild(el);
    });
  } else {
    sessionModalList.innerHTML = '<div class="session-item"><small>No sessions yet.</small></div>';
  }
  sessionModal.classList.remove("hidden");
}

sessionNewBtn?.addEventListener("click", async () => {
  if (sessionModal) sessionModal.classList.add("hidden");
  await resetSession();
  fetchSessions();
});

sessionResumeBtn?.addEventListener("click", async () => {
  if (sessionModal) sessionModal.classList.add("hidden");
  try {
    const res = await fetch("/api/sessions/latest", {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (res.ok) {
      const data = await res.json();
      hydrateSession(data);
    } else {
      await resetSession();
    }
  } catch {
    await resetSession();
  }
});

document.querySelector("#session-modal .modal-backdrop")?.addEventListener("click", () => {
  sessionModal?.classList.add("hidden");
});
