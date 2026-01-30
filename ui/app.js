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

let sessionId = crypto.randomUUID();
let agentState = {};
let currentAgents = new Set();
let notificationsEnabled = true;
const conversationLog = [];

function renderStages() {
  agentList.innerHTML = "";
  flowStrip.innerHTML = "";
  workflowStages.forEach((stage) => {
    const status = getStageStatus(stage.id);
    const preview = getStagePreview(stage.id);

    const card = document.createElement("div");
    card.className = "agent-card";

    const avatar = document.createElement("div");
    avatar.className = "agent-avatar";
    const avatarImg = document.createElement("img");
    avatarImg.src = stage.avatar;
    avatarImg.alt = stage.label;
    avatar.appendChild(avatarImg);

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
  meta.textContent = kind;
  const body = document.createElement("div");
  body.textContent = content;
  item.appendChild(meta);
  item.appendChild(body);
  handoffList.prepend(item);
}

function appendMessage(role, content) {
  const item = document.createElement("div");
  item.className = `message ${role}`;
  const meta = document.createElement("small");
  meta.textContent = `${role === "user" ? "You" : role === "error" ? "Error" : "Assistant"}`;
  const body = document.createElement("div");
  body.innerHTML = role === "assistant" ? formatAssistantMessage(content) : formatMessage(content);
  item.appendChild(meta);
  item.appendChild(body);
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
          <span class="section-icon">${iconMap[section.title] || "✅"}</span>
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

function resetSession() {
  sessionId = crypto.randomUUID();
  agentState = {};
  currentAgents = new Set();
  handoffList.innerHTML = "";
  chatMessages.innerHTML = "";
  conversationLog.length = 0;
  resetArtifacts();
  updateSessionPill();
  renderStages();
  connectWebSocket();
}

let ws;
function getSelectedPattern() {
  const active = patternOptions?.querySelector(".pattern-btn.active");
  return active?.dataset?.pattern || "sequential";
}

function setActivePattern(pattern) {
  if (!patternOptions) return;
  patternOptions.querySelectorAll(".pattern-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pattern === pattern);
  });
}

function connectWebSocket() {
  if (ws) ws.close();
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({ session_id: sessionId, access_token: null, pattern: getSelectedPattern() }));
  };
  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    handleEvent(payload);
  };
  ws.onclose = () => {
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
      renderStages();
      updateRiskFromText(event.content || "");
      break;
    case "tool_called":
      appendTimeline("tool", `${event.agent_id}: ${event.tool_name}`);
      break;
    case "final_result":
      if (event.content) appendMessage("assistant", event.content);
      if (event.content) conversationLog.push({ role: "assistant", content: event.content });
      break;
    case "error":
      if (event.message) appendMessage("error", event.message);
      break;
    default:
      break;
  }
}

function sendMessage() {
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  appendMessage("user", text);
  conversationLog.push({ role: "user", content: text });
  ws.send(
    JSON.stringify({
      session_id: sessionId,
      prompt: text,
      access_token: null,
      pattern: getSelectedPattern(),
    })
  );
  input.value = "";
}

function updateSessionPill() {
  sessionPill.textContent = `Session · ${sessionId.slice(0, 8)}`;
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

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

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
  showToast("Exported session data");
});

shareButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Share link copied");
  } catch (err) {
    showToast("Unable to copy link");
  }
});

notifyButton?.addEventListener("click", () => {
  notificationsEnabled = !notificationsEnabled;
  notifyButton.classList.toggle("active", notificationsEnabled);
  showToast(notificationsEnabled ? "Notifications on" : "Notifications off");
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
newSessionButton.addEventListener("click", resetSession);
patternOptions?.addEventListener("click", (event) => {
  const button = event.target.closest(".pattern-btn");
  if (!button) return;
  const pattern = button.dataset.pattern;
  setActivePattern(pattern);
  renderStages();
  showToast(`Pattern set to ${button.textContent}`);
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

setActivePattern("sequential");
updateSessionPill();
resetArtifacts();
renderStages();
connectWebSocket();
