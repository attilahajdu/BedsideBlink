// BedsideBlink MVP - Full implementation per specification
// Face detection + long-blink selection (unchanged). All screens and flow built here.

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function eyeAspectRatio(landmarks, indices) {
  const p = i => landmarks[indices[i]];
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return (d(p(1), p(5)) + d(p(2), p(4))) / (2 * d(p(0), p(3)) + 1e-6);
}

const BLINK_BUFFER_MS = 150;

function getSelectionBlinkThresholdMs() {
  return config.selection_blink_ms + BLINK_BUFFER_MS;
}

const COLORS = {
  white: "#94a3b8",
  yellow: "#eab308",
  blue: "#38bdf8",
  green: "#4ade80",
  orange: "#fb923c",
  pink: "#f472b6",
  red: "#f87171"
};

// Lucide icon names (MIT license, https://lucide.dev)
const LUCIDE_ICONS = {
  urgent: "triangle-alert",
  comfort: "heart",
  spelling: "type",
  quick: "circle-check",
  thumbsUp: "thumbs-up",
  thumbsDown: "thumbs-down",
  breathing: "wind",
  head: "user",
  pain: "thermometer",
  body: "circle-user",
  position: "layout-grid",
  toilet: "bath",
  people: "users",
  clothing: "shirt",
  yes: "check",
  no: "x",
  back: "arrow-left",
  sayMore: "message-circle",
  done: "circle-check-big",
  prev: "chevron-left",
  next: "chevron-right",
  numbers: "hash",
  letters: "type",
  controls: "settings"
};

function hexToRgba(hex, alpha) {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
function hexToTintStyle(hex) {
  return ` style="--tint-color: ${hexToRgba(hex, 0.22)}"`;
}
function getIconName(item, label, context) {
  const l = (label || "").toLowerCase();
  const id = typeof item === "object" && item.id;
  if (id === "urgent") return LUCIDE_ICONS.urgent;
  if (id === "comfort") return LUCIDE_ICONS.comfort;
  if (id === "spelling") return LUCIDE_ICONS.spelling;
  if (id === "quick") return LUCIDE_ICONS.quick;
  if (label === BACK_ONE_LEVEL_LABEL || label === BACK_ONE_LEVEL_SPELLING || l === "back one level") return LUCIDE_ICONS.back;
  if (label === "PREV PAGE" || l === "prev page") return LUCIDE_ICONS.prev;
  if (label === "NEXT PAGE" || l === "next page") return LUCIDE_ICONS.next;
  if (label === "Yes, that's right" || label === "YES" || label?.startsWith("Yes")) return LUCIDE_ICONS.yes;
  if (label === "No, go back" || label === "NO" || label?.startsWith("No,")) return LUCIDE_ICONS.no;
  if (label === "I need something else") return LUCIDE_ICONS.sayMore;
  if (label === "I'm finished") return LUCIDE_ICONS.done;
  if (label === "SAY MORE") return LUCIDE_ICONS.sayMore;
  if (label === "I'M DONE") return LUCIDE_ICONS.done;
  const gId = typeof item === "object" && item.id;
  if (gId === "white_group" || l.includes("breathing") || l.includes("airway")) return LUCIDE_ICONS.breathing;
  if (gId === "head_face_mouth" || (gId === "yellow_group" && context === "urgent")) return LUCIDE_ICONS.head;
  if (gId === "pink_group" && context === "urgent") return LUCIDE_ICONS.pain;
  if (gId === "blue_group" && context === "urgent") return LUCIDE_ICONS.body;
  if (gId === "blue_group" && context === "comfort") return LUCIDE_ICONS.position;
  if (gId === "green_group") return LUCIDE_ICONS.toilet;
  if (gId === "pink_group" && context === "comfort") return LUCIDE_ICONS.people;
  if (gId === "yellow_group" && context === "comfort") return LUCIDE_ICONS.clothing;
  if (id === "numbers") return LUCIDE_ICONS.numbers;
  if (id === "controls") return LUCIDE_ICONS.controls;
  if (id && id.startsWith("row_")) return LUCIDE_ICONS.letters;
  return null;
}

const COMM_HISTORY_KEY = "bedsideblink_comm_history";
const COMM_HISTORY_MAX = 300;
/** Local device config (boards, navigation_root). Normal user flow uses this only; cloud is explicit. */
const LOCAL_CONFIG_KEY = "bedsideblink_local_config";
const DEVICE_ID_KEY = "bedsideblink_device_id";
const LAST_CLOUD_BACKUP_KEY = "bedsideblink_last_cloud_backup";
const STATE_ORIGIN_KEY = "bedsideblink_state_origin";
const LOCAL_BACKUP_PREFIX = "bedsideblink_local_backup_";
const SETTINGS_SCHEMA_VERSION = 1;
const MAX_IMPORT_SIZE_BYTES = 500000;

function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = "dev_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return "dev_unknown";
  }
}

function loadCommunicationHistory() {
  try {
    const s = localStorage.getItem(COMM_HISTORY_KEY);
    const hist = s ? JSON.parse(s) : [];
    return hist.map((e, i) => ({
      id: e.id || "legacy_" + i + "_" + Date.now(),
      time: e.time || "—",
      date: e.date || "—",
      label: e.label || "",
      done: !!e.done,
      doneDate: e.doneDate || null
    }));
  } catch (_) { return []; }
}

function saveCommunicationHistory(hist) {
  try {
    localStorage.setItem(COMM_HISTORY_KEY, JSON.stringify(hist.slice(-COMM_HISTORY_MAX)));
  } catch (_) {}
}

function logEvent(label) {
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), time, date, label, done: false };
  state.session.push({ time, label });
  const hist = loadCommunicationHistory();
  hist.push(entry);
  saveCommunicationHistory(hist);
}

let config = {
  scan_speed_ms: 5000,
  selection_blink_ms: 800,
  emergency_blink_ms: 4000,
  auditory_scanning: true,
  volume: 0.8,
  max_items_per_page: 8,
  voiceUri: null,
  voiceEngine: "browser",
  piperVoiceId: null,
  responsiveVoiceKey: ""
};

function getScanSpeedLabel(ms) {
  if (ms <= 3333) return "Fast";
  if (ms <= 5666) return "Medium";
  return "Slow";
}
function getSelectionBlinkLabel(ms) {
  if (ms <= 833) return "Easier";
  if (ms <= 1166) return "Medium";
  return "Quick";
}
function getEmergencyBlinkLabel(ms) {
  if (ms <= 4333) return "Shorter hold";
  if (ms <= 6333) return "Medium";
  return "Long hold";
}

let piperTtsModule = null;
let piperLoadFailed = false;
let responsiveVoiceReady = false;

const PIPER_VOICES = [
  { id: "en_US-hfc_female-medium", name: "English (US) Female" },
  { id: "en_US-lessac-medium", name: "English (US) Lessac" },
  { id: "en_GB-alba-medium", name: "English (UK) Alba" },
  { id: "en_US-libritts-high", name: "English (US) LibriTTS" },
  { id: "en_US-danny-low", name: "English (US) Danny" },
  { id: "en_GB-cori-medium", name: "English (UK) Cori" }
];

let content = null;
let supabaseClient = null;

let state = {
  screen: "face_ready",
  faceLandmarker: null,
  video: null,
  stream: null,
  lastFrameTime: 0,
  faceDetected: false,
  blinkStart: 0,
  cooldownUntil: 0,
  scanIndex: 0,
  scanItems: [],
  scanInterval: null,
  scanTickDuration: 5000,
  session: [],
  paused: false,
  faceLostAt: null,
  contentBoard: null,
  itemPage: 0,
  spellingWord: "",
  spellingRowIndex: 0,
  spellingCharIndex: 0,
  spellingPhase: "row", // row | char
  navStack: [],
  config: null,
  lastSelection: "",
  quickYesNoReturnScreen: null,
  calibrationMode: null,
  calibrationData: { normalBlinks: [], deliberateBlinks: [] },
  calibrationCompleted: false,
  faceReadyBlinkCount: 0,
  scanTickStart: 0,
  summaryBlinkCount: 0,
  summaryLastBlinkTime: 0,
  SUMMARY_BLINK_WINDOW_MS: 4000,
  caregiverMode: false,
  authUser: null,
  otpState: "signed_out",
  otpError: "",
  otpResendAt: 0,
  otpEmail: "",
  lastCloudBackupAt: null,
  stateOrigin: "local"
};

const CAREGIVER_MODE_KEY = "bedsideblink_caregiver_mode";
const ONBOARDING_SEEN_KEY = "bedsideblink_onboarding_seen";

function closeCaregiverPanel() {
  document.body.classList.remove("nav-panel-open");
  const panel = document.getElementById("caregiver-nav-panel");
  if (panel) {
    panel.classList.remove("panel-open");
    panel.setAttribute("aria-hidden", "true");
  }
  const menuBtn = document.getElementById("btn-caregiver-menu");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}

function openCaregiverPanel() {
  document.body.classList.add("nav-panel-open");
  const panel = document.getElementById("caregiver-nav-panel");
  if (panel) {
    panel.classList.add("panel-open");
    panel.setAttribute("aria-hidden", "false");
  }
  const menuBtn = document.getElementById("btn-caregiver-menu");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
}

function toggleCaregiverPanel() {
  const panel = document.getElementById("caregiver-nav-panel");
  const isOpen = panel && panel.classList.contains("panel-open");
  if (isOpen) closeCaregiverPanel();
  else openCaregiverPanel();
}

function setCaregiverMode(on) {
  const wasCaregiver = state.caregiverMode;
  state.caregiverMode = !!on;
  try { localStorage.setItem(CAREGIVER_MODE_KEY, state.caregiverMode ? "1" : "0"); } catch (_) {}
  document.body.classList.toggle("patient-mode", !state.caregiverMode);
  const btn = document.getElementById("caregiver-toggle");
  if (btn) btn.textContent = state.caregiverMode ? "Patient view" : "Caregiver";
  const panelBtn = document.getElementById("caregiver-toggle-panel");
  if (panelBtn) panelBtn.textContent = state.caregiverMode ? "Patient view" : "Caregiver";
  if (!state.caregiverMode) closeCaregiverPanel();
  else openCaregiverPanel();
  updateStatusHint();
  if (state.caregiverMode && !wasCaregiver) {
    const toast = document.getElementById("global-toast");
    if (toast) {
      toast.textContent = "Caregiver mode — use the menu on the right for Summary, Setup, and more.";
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 3000);
    }
  }
}

function toggleCaregiverMode() {
  setCaregiverMode(!state.caregiverMode);
}

function updateStatusHint() {
  const el = document.getElementById("status-hint");
  if (!el) return;
  if (state.caregiverMode) {
    el.textContent = "Long blink to choose";
  } else {
    el.textContent = "";
  }
}

function getScanDurationMs(forSpelling = false) {
  return Math.min(8000, Math.max(2000, config.scan_speed_ms));
}

function initSupabase() {
  const url = typeof window !== "undefined" && window.BEDSIDEBLINK_SUPABASE_URL;
  const key = typeof window !== "undefined" && window.BEDSIDEBLINK_SUPABASE_ANON_KEY;
  const supabaseLib = typeof window !== "undefined" && window.supabase;
  if (url && key && supabaseLib) {
    supabaseClient = supabaseLib.createClient(url, key);
    return true;
  }
  if (!url || !key) {
    console.warn("Supabase: Missing config. Ensure supabase-config.js loads (hard refresh to avoid cache).");
  }
  if (!supabaseLib) {
    console.warn("Supabase: Library not loaded. Check network tab for supabase.min.js.");
  }
  return false;
}

async function loadConfigFromSupabase() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.from("bedsideblink_config").select("id, config").limit(1).maybeSingle();
    if (error) throw error;
    return data?.config ?? null;
  } catch (e) {
    console.warn("Supabase load failed:", e.message);
    return null;
  }
}

async function saveConfigToSupabase(cfg) {
  if (!supabaseClient) {
    console.warn("Supabase save failed: client not initialized. Add URL and anon key to supabase-config.js");
    return false;
  }
  try {
    const id = "11111111-1111-1111-1111-111111111111";
    const { error } = await supabaseClient.from("bedsideblink_config").upsert(
      { id, config: cfg, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Supabase save failed:", e.message);
    window.__lastSupabaseError = e.message;
    return false;
  }
}

const OTP_RESEND_COOLDOWN_MS = 60000;

async function checkAuthSession() {
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      state.authUser = { id: session.user.id, email: session.user.email || "" };
      state.otpState = "signed_in";
      state.otpError = "";
      const t = localStorage.getItem(LAST_CLOUD_BACKUP_KEY);
      state.lastCloudBackupAt = t || null;
      const o = localStorage.getItem(STATE_ORIGIN_KEY);
      state.stateOrigin = o || "local";
    } else {
      state.authUser = null;
      state.otpState = "signed_out";
    }
  } catch (_) {
    state.authUser = null;
    state.otpState = "signed_out";
  }
  renderAccountSection();
}

function renderAccountSection() {
  const wrap = document.getElementById("account-section-wrap");
  if (!wrap) return;
  const signedIn = !!state.authUser;
  const email = (state.otpEmail || state.authUser?.email || "").trim();
  if (signedIn) {
    wrap.innerHTML = `
      <div class="account-section">
        <h3 class="account-heading">Account</h3>
        <p class="account-email">Signed in as <strong>${escapeHtml(state.authUser.email || "")}</strong></p>
        <p class="account-state-origin">Current settings: <span class="account-origin-badge">${escapeHtml(state.stateOrigin.replace(/_/g, " "))}</span></p>
        ${state.lastCloudBackupAt ? `<p class="account-last-backup">Last cloud backup: ${escapeHtml(new Date(state.lastCloudBackupAt).toLocaleString())}</p>` : ""}
        <div class="account-actions">
          <button type="button" id="btn-save-to-cloud" class="caregiver-btn caregiver-btn-primary">Save to cloud</button>
          <button type="button" id="btn-load-from-cloud" class="caregiver-btn">Load from cloud</button>
          <button type="button" id="btn-change-email" class="caregiver-btn">Change email</button>
          <button type="button" id="btn-recovery-code" class="caregiver-btn">Recovery code</button>
          <button type="button" id="btn-restore-previous" class="caregiver-btn">Restore previous</button>
          <button type="button" id="btn-sign-out" class="caregiver-btn">Sign out</button>
        </div>
      </div>`;
    wrap.querySelector("#btn-save-to-cloud")?.addEventListener("click", () => saveToCloud());
    wrap.querySelector("#btn-load-from-cloud")?.addEventListener("click", () => loadFromCloudConfirm());
    wrap.querySelector("#btn-change-email")?.addEventListener("click", () => showChangeEmail());
    wrap.querySelector("#btn-recovery-code")?.addEventListener("click", () => showRecoveryCode());
    wrap.querySelector("#btn-restore-previous")?.addEventListener("click", () => {
      if (restoreLocalBackup()) { renderAccountSection(); alert("Previous settings restored."); } else { alert("No backup to restore."); }
    });
    wrap.querySelector("#btn-sign-out")?.addEventListener("click", () => signOut());
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "caregiver-btn";
    exportBtn.textContent = "Export settings";
    exportBtn.addEventListener("click", () => exportSettings());
    wrap.querySelector(".account-actions")?.appendChild(exportBtn);
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "caregiver-btn";
    importBtn.textContent = "Import from file";
    importBtn.addEventListener("click", () => importSettings());
    wrap.querySelector(".account-actions")?.appendChild(importBtn);
    return;
  }
  if (state.otpState === "sending_code" || state.otpState === "verifying") {
    wrap.innerHTML = `
      <div class="account-section">
        <h3 class="account-heading">Account</h3>
        <p class="account-status">${state.otpState === "sending_code" ? "Sending code…" : "Verifying…"}</p>
      </div>`;
    return;
  }
  if (state.otpState === "code_sent") {
    const resendDisabled = Date.now() < state.otpResendAt;
    const resendSec = resendDisabled ? Math.ceil((state.otpResendAt - Date.now()) / 1000) : 0;
    wrap.innerHTML = `
      <div class="account-section">
        <h3 class="account-heading">Account</h3>
        <p class="account-email-sent">Enter the code we sent to <strong>${escapeHtml(email)}</strong></p>
        <input type="text" id="account-otp-code" class="account-otp-input" placeholder="6-digit code" maxlength="6" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]*">
        <p id="account-otp-error" class="account-error ${state.otpError ? "" : "hidden"}">${escapeHtml(state.otpError)}</p>
        <div class="account-actions">
          <button type="button" id="btn-verify-otp" class="caregiver-btn caregiver-btn-primary">Verify</button>
          <button type="button" id="btn-resend-otp" class="caregiver-btn" ${resendDisabled ? "disabled" : ""}>${resendDisabled ? `Resend in ${resendSec}s` : "Resend code"}</button>
          <button type="button" id="btn-otp-back" class="caregiver-btn">Back</button>
        </div>
      </div>`;
    wrap.querySelector("#btn-verify-otp")?.addEventListener("click", () => verifyOtpSubmit());
    wrap.querySelector("#btn-resend-otp")?.addEventListener("click", () => sendOtp(email));
    wrap.querySelector("#btn-otp-back")?.addEventListener("click", () => { state.otpState = "signed_out"; state.otpError = ""; renderAccountSection(); });
    wrap.querySelector("#account-otp-code")?.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyOtpSubmit(); });
    return;
  }
  wrap.innerHTML = `
    <div class="account-section">
      <h3 class="account-heading">Account</h3>
      <p class="account-hint">Sign in to save or load settings from the cloud. Your local settings stay on this device.</p>
      <p id="account-otp-error" class="account-error ${state.otpError ? "" : "hidden"}">${escapeHtml(state.otpError)}</p>
      <div class="account-email-row">
        <input type="email" id="account-email" class="account-email-input" placeholder="Your email" value="${escapeHtml(email)}">
        <button type="button" id="btn-send-otp" class="caregiver-btn caregiver-btn-primary account-btn-send-otp">Send one-time code</button>
      </div>
      <div class="account-actions account-actions-export-import">
        <button type="button" id="btn-export-settings" class="caregiver-btn">Export settings</button>
        <button type="button" id="btn-import-settings" class="caregiver-btn">Import from file</button>
      </div>
    </div>`;
  wrap.querySelector("#btn-export-settings")?.addEventListener("click", () => exportSettings());
  wrap.querySelector("#btn-import-settings")?.addEventListener("click", () => importSettings());
  wrap.querySelector("#btn-send-otp")?.addEventListener("click", () => {
    const input = wrap.querySelector("#account-email");
    const em = (input?.value || "").trim();
    if (!em) { state.otpError = "Enter your email."; renderAccountSection(); return; }
    sendOtp(em);
  });
}

async function sendOtp(email) {
  if (!supabaseClient) { state.otpError = "Not connected."; renderAccountSection(); return; }
  state.otpState = "sending_code";
  state.otpError = "";
  renderAccountSection();
  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true }
    });
    if (error) throw error;
    state.otpState = "code_sent";
    state.otpEmail = email.trim();
    state.otpResendAt = Date.now() + OTP_RESEND_COOLDOWN_MS;
  } catch (e) {
    state.otpState = "signed_out";
    state.otpError = e?.message || "Failed to send code.";
  }
  renderAccountSection();
}

async function verifyOtpSubmit() {
  const codeEl = document.getElementById("account-otp-code");
  const code = (codeEl?.value || "").trim().replace(/\s/g, "");
  if (!code) { state.otpError = "Enter the code from your email."; renderAccountSection(); return; }
  if (!supabaseClient) { state.otpError = "Not connected."; renderAccountSection(); return; }
  state.otpState = "verifying";
  state.otpError = "";
  renderAccountSection();
  try {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email: state.otpEmail,
      token: code,
      type: "email"
    });
    if (error) throw error;
    if (data?.user) {
      state.authUser = { id: data.user.id, email: data.user.email || state.otpEmail };
      state.otpState = "signed_in";
      state.otpError = "";
      state.otpEmail = "";
    } else {
      state.otpState = "code_sent";
      state.otpError = "Verification failed.";
    }
  } catch (e) {
    state.otpState = "code_sent";
    state.otpError = e?.message || "Invalid or expired code. Request a new code.";
  }
  renderAccountSection();
}

async function signOut() {
  if (!supabaseClient) return;
  try {
    await supabaseClient.auth.signOut();
  } catch (_) {}
  state.authUser = null;
  state.otpState = "signed_out";
  state.otpError = "";
  state.otpEmail = "";
  renderAccountSection();
}

function showChangeEmail() {
  const newEmail = prompt("Enter new email address:");
  if (!newEmail?.trim()) return;
  supabaseClient.auth.updateUser({ email: newEmail.trim() }).then(({ data, error }) => {
    if (error) { alert(error.message); return; }
    if (data?.user) state.authUser = { id: data.user.id, email: data.user.email || newEmail.trim() };
    renderAccountSection();
  });
}

function showRecoveryCode() {
  alert("Recovery code setup will be available after the first cloud backup. Save your settings to the cloud, then return here. For now, use Export to create a backup file.");
}

function buildSettingsPayload(forExport) {
  const calibrationRaw = localStorage.getItem("bedsideblink_calibration");
  let calibration = {};
  try {
    if (calibrationRaw) calibration = JSON.parse(calibrationRaw);
  } catch (_) {}
  const voiceRaw = localStorage.getItem("bedsideblink_voice");
  let voice = {};
  try {
    if (voiceRaw) voice = JSON.parse(voiceRaw);
  } catch (_) {}
  const payload = {
    schema_version: SETTINGS_SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
    device_id: getOrCreateDeviceId(),
    settings: {
      boards: state.config?.boards ?? {},
      navigation_root: state.config?.navigation_root ?? { scan_order: ["urgent_needs", "comfort_care", "spelling", "quick_yes_no"] },
      calibration: {
        scan_speed_ms: calibration.scan_speed_ms ?? config.scan_speed_ms,
        selection_blink_ms: calibration.selection_blink_ms ?? config.selection_blink_ms,
        calibrationCompleted: !!calibration.calibrationCompleted
      },
      voice: {
        voiceEngine: voice.voiceEngine ?? config.voiceEngine,
        piperVoiceId: voice.piperVoiceId ?? config.piperVoiceId
        // responsiveVoiceKey omitted: API key stays local only, never in cloud or export
      }
    }
  };
  if (forExport) payload.exported_at = new Date().toISOString();
  return payload;
}

function validateSettingsPayload(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Invalid payload." };
  const v = obj.schema_version;
  if (v === undefined || v === null) return { ok: false, error: "Missing schema_version." };
  if (v !== 1 && v !== "1") return { ok: false, error: "Unsupported schema_version." };
  const s = obj.settings;
  if (!s || typeof s !== "object") return { ok: false, error: "Missing settings." };
  if (typeof s.boards !== "object" || s.boards === null) return { ok: false, error: "Invalid settings.boards." };
  if (typeof s.navigation_root !== "object" || s.navigation_root === null) return { ok: false, error: "Invalid settings.navigation_root." };
  return { ok: true };
}

function applySettingsPayload(payload) {
  const s = payload.settings;
  if (!s) return;
  if (s.boards) state.config = { ...state.config, boards: s.boards };
  if (s.navigation_root) state.config = { ...state.config, navigation_root: s.navigation_root };
  try {
    if (s.calibration) {
      const cal = s.calibration;
      if (typeof cal.scan_speed_ms === "number") config.scan_speed_ms = Math.min(8000, Math.max(2000, cal.scan_speed_ms));
      if (typeof cal.selection_blink_ms === "number") config.selection_blink_ms = Math.min(1500, Math.max(500, cal.selection_blink_ms));
      if (typeof cal.calibrationCompleted === "boolean") state.calibrationCompleted = cal.calibrationCompleted;
      localStorage.setItem("bedsideblink_calibration", JSON.stringify({
        scan_speed_ms: config.scan_speed_ms,
        selection_blink_ms: config.selection_blink_ms,
        calibrationCompleted: state.calibrationCompleted
      }));
    }
    if (s.voice) {
      const v = s.voice;
      if (v.voiceEngine != null) config.voiceEngine = v.voiceEngine;
      if (v.piperVoiceId != null) config.piperVoiceId = v.piperVoiceId;
      // responsiveVoiceKey never applied from payload: API key stays local only
      saveVoiceConfig();
    }
    const toSave = { boards: state.config.boards, navigation_root: state.config.navigation_root };
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("Apply settings failed:", e.message);
  }
}

function createLocalBackup() {
  try {
    const payload = buildSettingsPayload(false);
    const key = LOCAL_BACKUP_PREFIX + Date.now();
    localStorage.setItem(key, JSON.stringify(payload));
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LOCAL_BACKUP_PREFIX)) keys.push(k);
    }
    keys.sort();
    while (keys.length > 5) {
      localStorage.removeItem(keys.shift());
    }
    return true;
  } catch (_) {
    return false;
  }
}

function restoreLocalBackup() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(LOCAL_BACKUP_PREFIX)) keys.push(k);
  }
  if (keys.length === 0) return false;
  keys.sort().reverse();
  const raw = localStorage.getItem(keys[0]);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    const result = validateSettingsPayload(payload);
    if (!result.ok) return false;
    applySettingsPayload(payload);
    state.stateOrigin = "local";
    try { localStorage.setItem(STATE_ORIGIN_KEY, "local"); } catch (_) {}
    return true;
  } catch (_) {
    return false;
  }
}

async function saveToCloud() {
  if (!supabaseClient || !state.authUser) return;
  // uid is from Supabase session only; RLS WITH CHECK (auth.uid() = user_id) rejects any mismatch
  const uid = state.authUser.id;
  const payload = buildSettingsPayload(false);
  const row = {
    user_id: uid,
    settings: payload.settings,
    schema_version: SETTINGS_SCHEMA_VERSION,
    updated_at: new Date().toISOString()
  };
  try {
    const { error } = await supabaseClient.from("user_settings").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
    const now = new Date().toISOString();
    state.lastCloudBackupAt = now;
    try { localStorage.setItem(LAST_CLOUD_BACKUP_KEY, now); } catch (_) {}
    renderAccountSection();
    alert("Settings saved to the cloud.");
  } catch (e) {
    console.warn("Save to cloud failed:", e.message);
    alert("Could not save to cloud: " + (e?.message || "unknown error"));
  }
}

function loadFromCloudConfirm() {
  if (!supabaseClient || !state.authUser) return;
  (async () => {
    try {
      const { data, error } = await supabaseClient.from("user_settings").select("settings, schema_version, updated_at").maybeSingle();
      if (error) throw error;
      if (!data) {
        alert("No cloud backup found. Save to cloud first.");
        return;
      }
      const payload = { schema_version: data.schema_version, updated_at: data.updated_at, device_id: "", settings: data.settings };
      const result = validateSettingsPayload(payload);
      if (!result.ok) {
        alert("Cloud data is invalid: " + result.error);
        return;
      }
      const msg = `Load backup from ${new Date(data.updated_at).toLocaleString()}?\n\nThis will replace your current local settings. A backup of your current settings will be created first.`;
      if (!confirm(msg)) return;
      if (!createLocalBackup()) {
        alert("Could not create local backup. Aborting.");
        return;
      }
      applySettingsPayload(payload);
      state.stateOrigin = "cloud_backed";
      try { localStorage.setItem(STATE_ORIGIN_KEY, "cloud_backed"); } catch (_) {}
      state.lastCloudBackupAt = data.updated_at;
      try { localStorage.setItem(LAST_CLOUD_BACKUP_KEY, data.updated_at); } catch (_) {}
      renderAccountSection();
      alert("Settings loaded from cloud. You can use \"Restore previous\" in Account to undo.");
    } catch (e) {
      console.warn("Load from cloud failed:", e.message);
      alert("Could not load from cloud: " + (e?.message || "unknown error"));
    }
  })();
}

function exportSettings() {
  const payload = buildSettingsPayload(true);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bedsideblink-settings.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importSettings() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE_BYTES) {
      alert("File is too large. Maximum size is " + (MAX_IMPORT_SIZE_BYTES / 1000) + " KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try {
        payload = JSON.parse(reader.result);
      } catch (_) {
        alert("Invalid JSON file.");
        return;
      }
      const result = validateSettingsPayload(payload);
      if (!result.ok) {
        alert("Invalid settings file: " + result.error);
        return;
      }
      const updatedAt = payload.updated_at || payload.exported_at || "unknown";
      const msg = `Import settings from ${updatedAt}?\n\nThis will replace your current local settings. A backup will be created first.`;
      if (!confirm(msg)) return;
      if (!createLocalBackup()) {
        alert("Could not create backup. Aborting.");
        return;
      }
      applySettingsPayload(payload);
      state.stateOrigin = "imported";
      try { localStorage.setItem(STATE_ORIGIN_KEY, "imported"); } catch (_) {}
      renderAccountSection();
      alert("Settings imported.");
    };
    reader.readAsText(file);
  };
  input.click();
}

async function loadContent() {
  try {
    const r = await fetch("content.json");
    if (!r.ok) throw new Error(`Content load failed (${r.status})`);
    content = await r.json();
    config.scan_speed_ms = content.system_config?.interaction_rules?.scan_speed_ms ?? 5000;
    config.selection_blink_ms = content.system_config?.interaction_rules?.selection_blink_ms ?? 800;
    config.emergency_blink_ms = content.system_config?.interaction_rules?.emergency_blink_ms ?? 4000;
  } catch (e) {
    console.warn("Using default config:", e.message);
    content = { boards: {}, navigation_root: { scan_order: ["urgent_needs", "comfort_care", "spelling", "quick_yes_no"] } };
  }
  initSupabase();
  const baseBoards = content?.boards || {};
  const baseNav = content?.navigation_root || { scan_order: ["urgent_needs", "comfort_care", "spelling", "quick_yes_no"] };
  let localConfig = null;
  try {
    const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (raw) localConfig = JSON.parse(raw);
  } catch (_) {}
  state.config = {
    boards: { ...baseBoards, ...(localConfig?.boards || {}) },
    navigation_root: { ...baseNav, ...(localConfig?.navigation_root || {}) }
  };
  try {
    const o = localStorage.getItem(STATE_ORIGIN_KEY);
    if (o) state.stateOrigin = o;
  } catch (_) {}
  const saved = localStorage.getItem("bedsideblink_calibration");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      const ms = data?.selection_blink_ms;
      if (typeof ms === "number" && ms >= 500 && ms <= 1500) {
        config.selection_blink_ms = ms;
        state.calibrationCompleted = !!data.calibrationCompleted;
      }
      const scanMs = data?.scan_speed_ms;
      if (typeof scanMs === "number" && scanMs >= 2000 && scanMs <= 8000) {
        config.scan_speed_ms = scanMs;
      }
    } catch (_) {}
  }
  const voiceSaved = localStorage.getItem("bedsideblink_voice");
  if (voiceSaved) {
    try {
      const v = JSON.parse(voiceSaved);
      if (v.voiceEngine) config.voiceEngine = v.voiceEngine;
      if (v.piperVoiceId != null && v.piperVoiceId !== "") config.piperVoiceId = v.piperVoiceId;
      else config.piperVoiceId = null;
      if (v.responsiveVoiceKey != null) config.responsiveVoiceKey = v.responsiveVoiceKey || "";
    } catch (_) {}
  }
}

function saveVoiceConfig() {
  try {
    localStorage.setItem("bedsideblink_voice", JSON.stringify({
      voiceEngine: config.voiceEngine,
      piperVoiceId: config.piperVoiceId,
      responsiveVoiceKey: config.responsiveVoiceKey
    }));
  } catch (_) {}
}

function playBeep(freq = 800, duration = 200) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(config.volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch (e) { console.warn("Audio failed", e); }
}

async function loadPiperTts() {
  if (piperTtsModule) return piperTtsModule;
  if (piperLoadFailed) return null;
  try {
    const mod = await import("https://esm.sh/@mintplex-labs/piper-tts-web@1.0.4");
    piperTtsModule = mod.default || mod;
    return piperTtsModule;
  } catch (e) {
    console.warn("Piper TTS load failed:", e);
    piperLoadFailed = true;
    return null;
  }
}

function isModalOpen() {
  const modals = ["settings-modal", "calibration-modal", "customize-modal", "daily-summary-modal", "sitemap-modal"];
  return modals.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
}

function saveCalibrationState() {
  const scanInput = document.getElementById("calibration-scan-speed");
  if (scanInput) {
    const val = parseInt(scanInput.value, 10);
    if (!isNaN(val) && val >= 2000 && val <= 8000) config.scan_speed_ms = val;
  }
  localStorage.setItem("bedsideblink_calibration", JSON.stringify({
    selection_blink_ms: config.selection_blink_ms,
    scan_speed_ms: config.scan_speed_ms,
    calibrationCompleted: state.calibrationCompleted
  }));
}

function updateCalibrationSliderLabel() {
  const el = document.getElementById("calibration-scan-speed");
  const labelEl = document.getElementById("calibration-scan-speed-label");
  const msEl = document.getElementById("calibration-scan-speed-ms");
  if (!el || !labelEl || !msEl) return;
  const ms = parseInt(el.value, 10) || config.scan_speed_ms;
  labelEl.textContent = getScanSpeedLabel(ms);
  msEl.textContent = String(ms);
}

function openCalibration() {
  state.calibrationMode = "normal_blinks";
  state.calibrationData = { normalBlinks: [], deliberateBlinks: [] };
  const scanInput = document.getElementById("calibration-scan-speed");
  if (scanInput) scanInput.value = config.scan_speed_ms;
  updateCalibrationSliderLabel();
  document.getElementById("calibration-success-wrap").classList.add("hidden");
  document.getElementById("calibration-actions").classList.remove("hidden");
  document.getElementById("calibration-modal").classList.remove("hidden");
  updateCalibrationStep();
}

function updateCalibrationStep() {
  const p = document.getElementById("calibration-step");
  if (!p) return;
  const d = state.calibrationData;
  if (state.calibrationMode === "normal_blinks") {
    const n = d.normalBlinks.length;
    p.textContent = n < 5 ? `Blink normally a few times. (${n}/5 recorded)` : "Normal blinks recorded. Moving to selection blink…";
  } else if (state.calibrationMode === "deliberate_blinks") {
    const n = d.deliberateBlinks.length;
    p.textContent = n < 3 ? `Do your selection blink — a longer, deliberate blink. (${n}/3)` : "Recording complete. Calculating threshold…";
  } else if (state.calibrationMode === "confirm") {
    p.textContent = `Selection blink set to ${config.selection_blink_ms} ms. Do a deliberate blink to confirm, or tap Close to skip.`;
  }
}

function handleCalibrationBlink(duration) {
  const d = state.calibrationData;
  if (state.calibrationMode === "normal_blinks") {
    if (duration < 600) d.normalBlinks.push(duration);
    if (d.normalBlinks.length >= 5) {
      state.calibrationMode = "deliberate_blinks";
      state.calibrationData.deliberateBlinks = [];
    }
  } else if (state.calibrationMode === "deliberate_blinks") {
    if (duration >= 400) d.deliberateBlinks.push(duration);
    if (d.deliberateBlinks.length >= 3) {
      const avg = d.deliberateBlinks.reduce((a, b) => a + b, 0) / 3;
      config.selection_blink_ms = Math.max(600, Math.round(avg * 0.95));
      state.calibrationMode = "confirm";
    }
  } else if (state.calibrationMode === "confirm") {
    if (duration >= config.selection_blink_ms * 0.8) {
      saveCalibrationState();
      state.calibrationMode = null;
      state.calibrationCompleted = true;
      document.getElementById("calibration-step").textContent = "";
      document.getElementById("calibration-actions").classList.add("hidden");
      document.getElementById("calibration-success-wrap").classList.remove("hidden");
      playBeep(800, 200);
    }
  }
  if (state.calibrationMode !== null) updateCalibrationStep();
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2);
  } catch (e) { console.warn("Alarm failed", e); }
}

// Soothing, natural-sounding female voices (Enhanced/Natural variants first; robotic ones last)
const PREFERRED_FEMALE_VOICES = [
  "Samantha (Enhanced)",
  "Samantha",
  "Karen",
  "Victoria",
  "Fiona",
  "Ava (Enhanced)",
  "Ava (Premium)",
  "Microsoft Aria",
  "Microsoft Emma",
  "Microsoft Zira",
  "Google UK English Female",
  "Google US English Female",
  "Google Australia English Female",
  "Moira"
];

function pickDefaultVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  for (const name of PREFERRED_FEMALE_VOICES) {
    const v = voices.find(x => (x.name || "").toLowerCase().includes(name.toLowerCase()));
    if (v) {
      config.voiceUri = v.voiceURI;
      return;
    }
  }
  const englishFemale = voices.find(v =>
    (v.lang.startsWith("en") || v.lang.startsWith("en-")) &&
    /female|woman|samantha|karen|victoria|zira|aria|fiona|ava|emma|moira/i.test(v.name || "")
  );
  if (englishFemale) config.voiceUri = englishFemale.voiceURI;
  else if (voices.length) config.voiceUri = voices[0].voiceURI;
}

function speakBrowser(text, noCancel = false) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.volume = Math.max(0.1, config.volume);
  u.rate = 0.85;
  u.pitch = 1;
  if (config.voiceUri) {
    const voice = speechSynthesis.getVoices().find(v => v.voiceURI === config.voiceUri);
    if (voice) u.voice = voice;
  }
  if (speechSynthesis.paused) speechSynthesis.resume();
  if (!noCancel) {
    speechSynthesis.cancel();
    setTimeout(() => { speechSynthesis.speak(u); }, 100);
  } else {
    speechSynthesis.speak(u);
  }
}

/** Returns a Promise that resolves when the speech engine is ready and the first utterance has started (or after a short fallback). */
function speakFirstAndWaitUntilStarted(text) {
  if (!text || isModalOpen()) return Promise.resolve();
  const engine = (config.voiceEngine || "browser").toLowerCase();
  if (engine === "responsivevoice" && config.responsiveVoiceKey) {
    speak(text);
    return new Promise((r) => setTimeout(r, 150));
  }
  if (engine === "piper" && config.piperVoiceId) {
    speak(text);
    return new Promise((r) => setTimeout(r, 200));
  }
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    let done = false;
    const trySpeak = () => {
      if (done) return;
      done = true;
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.max(0.1, config.volume);
      u.rate = 0.85;
      u.pitch = 1;
      if (config.voiceUri) {
        const voice = speechSynthesis.getVoices().find(v => v.voiceURI === config.voiceUri);
        if (voice) u.voice = voice;
      }
      u.onstart = () => resolve();
      u.onerror = () => resolve();
      u.onend = () => {};
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      setTimeout(() => resolve(), 3000);
    };
    if (voices.length) trySpeak();
    else {
      speechSynthesis.addEventListener("voiceschanged", () => trySpeak(), { once: true });
      setTimeout(() => trySpeak(), 2000);
    }
  });
}

/** Returns a Promise that resolves when the utterance has ended (or after a timeout). Use when you need to wait for speech to finish before continuing. */
function speakAndWaitUntilEnded(text) {
  if (!text || isModalOpen()) return Promise.resolve();
  const engine = (config.voiceEngine || "browser").toLowerCase();
  if (engine === "responsivevoice" && config.responsiveVoiceKey) {
    speak(text);
    return new Promise((r) => setTimeout(r, 2500));
  }
  if (engine === "piper" && config.piperVoiceId) {
    speak(text);
    return new Promise((r) => setTimeout(r, 2500));
  }
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    let tried = false;
    const finish = () => { resolve(); };
    const trySpeak = () => {
      if (tried) return;
      tried = true;
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.max(0.1, config.volume);
      u.rate = 0.85;
      u.pitch = 1;
      if (config.voiceUri) {
        const voice = speechSynthesis.getVoices().find(v => v.voiceURI === config.voiceUri);
        if (voice) u.voice = voice;
      }
      u.onend = finish;
      u.onerror = finish;
      if (speechSynthesis.paused) speechSynthesis.resume();
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      setTimeout(finish, 5000);
    };
    if (voices.length) trySpeak();
    else {
      speechSynthesis.addEventListener("voiceschanged", () => trySpeak(), { once: true });
      setTimeout(() => trySpeak(), 2000);
    }
  });
}

async function speak(text, forcePlay = false) {
  if (!config.auditory_scanning && !forcePlay) return;
  const engine = (config.voiceEngine || "browser").toLowerCase();

  if (engine === "responsivevoice" && config.responsiveVoiceKey) {
    if (!window.responsiveVoice) {
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://code.responsivevoice.org/1.9.9/responsivevoice.min.js?key=" + encodeURIComponent(config.responsiveVoiceKey);
        script.onload = () => {
          window.responsiveVoice.setDefaultVolume(config.volume);
          window.responsiveVoice.speak(text, "UK English Female", { rate: 0.85, pitch: 1, onend: resolve });
        };
        script.onerror = () => { speakBrowser(text, true); resolve(); };
        document.head.appendChild(script);
      });
    }
    window.responsiveVoice.setDefaultVolume(config.volume);
    window.responsiveVoice.speak(text, "UK English Female", { rate: 0.85, pitch: 1 });
    return;
  }

  if (engine === "piper" && config.piperVoiceId) {
    const mod = await loadPiperTts();
    if (mod && typeof mod.predict === "function") {
      try {
        const wav = await mod.predict({ text, voiceId: config.piperVoiceId });
        if (wav && wav instanceof Blob) {
          const url = URL.createObjectURL(wav);
          const audio = new Audio(url);
          audio.volume = Math.max(0.1, config.volume);
          audio.onended = () => URL.revokeObjectURL(url);
          await audio.play();
        }
        return;
      } catch (e) {
        console.warn("Piper speak failed, falling back to browser:", e);
      }
    }
  }

  speakBrowser(text, forcePlay || isModalOpen());
}

const SCREEN_LABELS = {
  face_ready: "Face ready",
  home: "Home",
  section: "Section",
  items: "Items",
  confirm: "Confirm",
  "anything-else": "Next",
  spelling: "Spelling",
  "quick-yes-no": "Quick YES/NO",
  summary: "Summary"
};

function showScreen(id) {
  if (state.screen === "face_ready" && id !== "face_ready") state.faceReadyBlinkCount = 0;
  document.querySelectorAll(".screen").forEach(s => { s.classList.remove("active"); s.classList.remove("full-split"); });
  const el = document.getElementById("screen-" + String(id).replace(/_/g, "-"));
  if (el) { el.classList.add("active"); if (id === "quick-yes-no") el.classList.add("full-split"); }
  state.screen = id;
  document.body.classList.remove("screen-face-ready", "screen-home", "screen-section", "screen-items", "screen-confirm", "screen-anything-else", "screen-spelling", "screen-quick-yes-no", "screen-summary");
  document.body.classList.add("screen-" + String(id).replace(/_/g, "-"));
  document.getElementById("face-lost-overlay")?.classList.add("hidden");
  updateStatus(SCREEN_LABELS[id] || id, state.lastSelection);
  if (id === "face_ready") {
    document.getElementById("btn-start").disabled = true;
    state.faceReadyBlinkCount = 0;
    updateFaceReadyBlinkHint();
    renderDailySummaryLanding();
  }
}

function updateStatus(step, last) {
  const s = document.getElementById("status-step");
  const l = document.getElementById("status-last");
  if (s) s.textContent = step || "";
  if (l) {
    const hist = loadCommunicationHistory();
    const mostRecent = hist.length > 0 ? hist[hist.length - 1] : null;
    const label = mostRecent?.label || last || "";
    const time = mostRecent?.time || "";
    if (label) {
      l.textContent = time ? `Last interaction: "${label}" at ${time}` : `Last interaction: "${label}"`;
    } else {
      l.textContent = "";
    }
  }
  updateStatusFaceIcon();
}

function updateStatusFaceIcon() {
  const el = document.getElementById("status-face-icon");
  if (!el) return;
  if (state.screen === "face_ready" && state.faceDetected) {
    el.classList.remove("hidden");
    el.innerHTML = '<i data-lucide="eye" class="status-eye-icon" aria-hidden="true"></i>';
    if (typeof lucide !== "undefined") lucide.createIcons({ root: el });
  } else {
    el.classList.add("hidden");
    el.innerHTML = "";
  }
}

function updateFaceReadyBlinkHint() {
  const hintEl = document.getElementById("face-ready-blink-hint");
  const countEl = document.getElementById("face-ready-blink-count");
  const btnStart = document.getElementById("btn-start");
  if (!hintEl || state.screen !== "face_ready") return;
  hintEl.classList.remove("hidden");
  const labelEl = hintEl.querySelector(".blink-hint-label");
  if (labelEl) {
    if (btnStart?.disabled) {
      labelEl.textContent = "Detecting face…";
    } else if (state.faceReadyBlinkCount >= 2) {
      labelEl.textContent = "Starting…";
    } else {
      labelEl.textContent = "Blink twice to begin";
    }
  }
  if (countEl) countEl.textContent = (btnStart?.disabled || state.faceReadyBlinkCount >= 2) ? "" : ` (${state.faceReadyBlinkCount} of 2 blinks)`;
}

let faceNotDetectedSeconds = 0;
let idleMessageShown = false;

function updateFaceStatusText() {
  const el = document.getElementById("face-status-text");
  const idleEl = document.getElementById("face-idle-text");
  if (!el || state.screen !== "face_ready") return;
  if (state.faceDetected) {
    faceNotDetectedSeconds = 0;
    idleMessageShown = false;
    el.textContent = "You are in position";
    el.classList.remove("hidden");
    if (idleEl) idleEl.classList.add("hidden");
  } else {
    if (faceNotDetectedSeconds >= 10 && idleEl) {
      idleMessageShown = true;
      el.classList.add("hidden");
      idleEl.classList.remove("hidden");
    } else {
      el.textContent = "Please stay within the frame";
      el.classList.remove("hidden");
      if (idleEl) idleEl.classList.add("hidden");
    }
  }
}

function setHistoryDone(id, done) {
  const hist = loadCommunicationHistory();
  const i = hist.findIndex(e => e.id === id);
  if (i >= 0) {
    hist[i].done = !!done;
    hist[i].doneDate = done ? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
    saveCommunicationHistory(hist);
  }
}

function renderCommunicationHistoryTable(containerId, options = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const hist = loadCommunicationHistory();
  const maxRows = options.maxRows ?? hist.length;
  const slice = [...hist].reverse().slice(0, maxRows);
  if (slice.length === 0) {
    el.innerHTML = '<div class="comm-history-inner"><p class="event-empty">No communications yet.</p><p class="event-empty-hint">When the patient selects an option (e.g. Thirsty, Pain), it will show here with the time. Entries stay on this device until you clear them.</p></div>';
    el.classList.remove("hidden");
    return;
  }
  el.classList.remove("hidden");
  const rows = slice.map(e => `
    <tr data-id="${escapeHtml(e.id)}" class="${e.done ? "comm-done" : ""}">
      <td class="event-time">${escapeHtml(e.date)} ${escapeHtml(e.time)}</td>
      <td class="event-label">${escapeHtml(e.label)}</td>
      <td class="event-done"><input type="checkbox" ${e.done ? "checked" : ""} aria-label="Taken care of" title="Taken care of"></td>
    </tr>`).join("");
  el.innerHTML = `
    <div class="comm-history-inner">
      <h3 class="comm-history-title">Communication history</h3>
      <table class="event-log event-log-glass">
        <thead><tr><th>Date & time</th><th>Action requested</th><th class="col-done">Done</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  el.querySelectorAll(".event-done input").forEach(cb => {
    cb.addEventListener("change", () => {
      const row = cb.closest("tr");
      const id = row?.dataset?.id;
      if (id) {
        setHistoryDone(id, cb.checked);
        row?.classList.toggle("comm-done", cb.checked);
        if (containerId === "summary-event-log") renderSummaryRequestCards();
      }
    });
  });
}

const COMPACT_EVENT_MAX_ROWS = 5;
const SUMMARY_EVENT_MAX_ROWS = 5;

function renderDailySummary() {
  const hist = loadCommunicationHistory();
  const flat = [...hist].sort((a, b) => {
    const da = parseDateKey(a.date || "—");
    const db = parseDateKey(b.date || "—");
    if (da - db !== 0) return db - da;
    return (b.time || "").localeCompare(a.time || "");
  });
  const contentEl = document.getElementById("daily-summary-content");
  if (flat.length === 0) {
    contentEl.innerHTML = '<p class="event-empty">No communications yet.</p><p class="event-empty-hint">When the patient selects an option, it will show here with the time. Entries stay on this device until you clear them.</p>';
    return;
  }
  const html = `
    <div class="daily-summary-table-wrap">
      <table class="daily-summary-table">
        <thead><tr><th>Date</th><th>Time</th><th>Request</th><th class="col-done">Done</th></tr></thead>
        <tbody>
          ${flat.map(e => `
            <tr class="${e.done ? "daily-summary-row-done" : ""}" data-id="${escapeHtml(e.id)}">
              <td class="daily-summary-date">${escapeHtml(e.date || "—")}</td>
              <td class="daily-summary-time">${escapeHtml(e.time || "—")}</td>
              <td class="daily-summary-label-cell">${escapeHtml(e.label || "")}</td>
              <td class="daily-summary-done-cell">
                <label><input type="checkbox" ${e.done ? "checked" : ""} aria-label="Mark as completed"></label>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  contentEl.innerHTML = html;
  contentEl.querySelectorAll(".daily-summary-done-cell input").forEach(cb => {
    cb.addEventListener("change", () => {
      const tr = cb.closest("tr");
      const id = tr?.dataset?.id;
      if (id) {
        setHistoryDone(id, cb.checked);
        tr?.classList.toggle("daily-summary-row-done", cb.checked);
      }
    });
  });
}

function parseDateKey(s) {
  if (!s || s === "—") return new Date(0);
  const m = s.match(/(\d{2})\s+(\w{3})\s+(\d{4})/);
  if (!m) return new Date(s);
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  return new Date(parseInt(m[3], 10), months[m[2]] ?? 0, parseInt(m[1], 10));
}

function renderDailySummaryLanding() {
  const el = document.getElementById("daily-summary-landing-content");
  if (!el) return;
  const hist = loadCommunicationHistory();
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const todayEntries = hist.filter(e => e.date === today).slice(-8).reverse();
  if (todayEntries.length === 0) {
    el.innerHTML = '<p class="event-empty">No communications today yet.</p><p class="event-empty-hint">When the patient selects an option, it will show here. Entries stay on this device until you clear them.</p>';
    return;
  }
  const html = todayEntries.map(e => {
    if (e.done) {
      return `<div class="daily-summary-landing-row daily-summary-done"><span class="time">${escapeHtml(e.time)}</span><span class="label">${escapeHtml(e.label)}</span><span class="done">✓</span></div>`;
    }
    return `<div class="daily-summary-landing-row" data-id="${escapeHtml(e.id)}"><label class="daily-summary-landing-check"><input type="checkbox" aria-label="Mark as done"> <span class="time">${escapeHtml(e.time)}</span><span class="label">${escapeHtml(e.label)}</span></label></div>`;
  }).join("");
  el.innerHTML = html;
  el.querySelectorAll(".daily-summary-landing-row[data-id] input").forEach(cb => {
    cb.addEventListener("change", () => {
      const row = cb.closest(".daily-summary-landing-row");
      const id = row?.dataset?.id;
      if (id) {
        setHistoryDone(id, cb.checked);
        renderDailySummaryLanding();
        renderDailySummaryHome();
      }
    });
  });
}

function renderDailySummaryHome() {
  const el = document.getElementById("daily-summary-home-content");
  if (!el) return;
  const hist = loadCommunicationHistory();
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const todayEntries = hist.filter(e => e.date === today).slice(-8).reverse();
  if (todayEntries.length === 0) {
    el.innerHTML = '<p class="event-empty">No communications today yet.</p><p class="event-empty-hint">When the patient selects an option, it will show here. Entries stay on this device until you clear them.</p>';
    return;
  }
  const html = todayEntries.map(e => {
    if (e.done) {
      return `<div class="daily-summary-landing-row daily-summary-done"><span class="time">${escapeHtml(e.time)}</span><span class="label">${escapeHtml(e.label)}</span><span class="done">✓</span></div>`;
    }
    return `<div class="daily-summary-landing-row" data-id="${escapeHtml(e.id)}"><label class="daily-summary-landing-check"><input type="checkbox" aria-label="Mark as done"> <span class="time">${escapeHtml(e.time)}</span><span class="label">${escapeHtml(e.label)}</span></label></div>`;
  }).join("");
  el.innerHTML = html;
  el.querySelectorAll(".daily-summary-landing-row[data-id] input").forEach(cb => {
    cb.addEventListener("change", () => {
      const row = cb.closest(".daily-summary-landing-row");
      const id = row?.dataset?.id;
      if (id) {
        setHistoryDone(id, cb.checked);
        renderDailySummaryLanding();
        renderDailySummaryHome();
      }
    });
  });
}

function renderFaceReadyEventLog() {
  const el = document.getElementById("face-ready-event-log");
  if (!el) return;
  renderCommunicationHistoryTable("face-ready-event-log", { maxRows: COMPACT_EVENT_MAX_ROWS });
}

function renderHomeEventLog() {
  const el = document.getElementById("home-event-log");
  if (!el) return;
  renderCommunicationHistoryTable("home-event-log", { maxRows: COMPACT_EVENT_MAX_ROWS });
}

function renderScanItems(items, activeIndex, onSelect, colorMap = null, iconMap = null, context = null, showIcons = false) {
  const html = items.map((item, i) => {
    const label = typeof item === "string" ? item : item.label || item;
    const safeLabel = escapeHtml(String(label ?? ""));
    const color = (colorMap && colorMap[i]) || (typeof item === "object" && item.color ? COLORS[item.color] : null);
    const cls = i === activeIndex ? "scan-item active" : "scan-item";
    const iconName = showIcons ? ((iconMap && iconMap[i]) || getIconName(item, label, context)) : null;
    const iconHtml = iconName ? `<i data-lucide="${escapeHtml(iconName)}" class="scan-item-icon" aria-hidden="true"></i>` : "";
    const timingHtml = '<span class="dwell-ring" aria-hidden="true"><span class="scan-item-timing" aria-live="polite"></span></span>';
    const selectHint = i === activeIndex ? '<span class="scan-item-select-hint">Long blink to choose</span>' : "";
    const tintStyle = color ? hexToTintStyle(color) : "";
    return `<div class="${cls}" data-index="${i}" data-selectable${tintStyle} data-label="${safeLabel}">${selectHint}${iconHtml}<span class="scan-item-label">${safeLabel}</span>${timingHtml}</div>`;
  }).join("");
  return html;
}

const BACK_TO_HOME_ITEM = { label: "Back to home", id: "back_to_home", isBackToHome: true };
const BACK_ONE_LEVEL_LABEL = "Back one level";
const BACK_ONE_LEVEL_SPELLING = "BACK ONE LEVEL";

function startScan(items, onSelect, options = {}) {
  if (state.scanInterval) clearInterval(state.scanInterval);
  const inFlow = options.screenId && options.screenId !== "home";
  const displayItems = inFlow ? [...items, BACK_TO_HOME_ITEM] : items;
  state.scanItems = displayItems;
  state.scanIndex = 0;
  state.lastShownScanIndex = 0;

  const wrappedOnSelect = (label, item) => {
    if (item && item.isBackToHome) {
      stopScan();
      goToLanding();
      return;
    }
    onSelect(label, item);
  };
  state.onScanSelect = wrappedOnSelect;
  state.scanOptions = options;
  const container = options.container;
  const colorMap = inFlow && Array.isArray(options.colorMap) ? [...options.colorMap, null] : options.colorMap;
  const iconMap = options.iconMap;
  const context = options.context;
  const showIcons = options.showIcons !== false;
  const isSpelling = options.screenId === "spelling";
  const scanDuration = getScanDurationMs(isSpelling);

  const firstItem = displayItems[0];
  const firstLabel = typeof firstItem === "string" ? firstItem : (firstItem?.label ?? firstItem);
  const speakOptions = options.speakOptions !== false;
  const useVoice = speakOptions && config.auditory_scanning && firstLabel && !isModalOpen();

  let firstTick = true;
  function tick() {
    if (state.paused || state.screen !== options.screenId) return;
    if (state.blinkStart > 0) return;
    state.scanTickStart = Date.now();
    state.scanTickDuration = scanDuration;
    const item = displayItems[state.scanIndex];
    const label = typeof item === "string" ? item : (item?.label ?? item);
    if (!firstTick && speakOptions && config.auditory_scanning && label && !isModalOpen()) speak(label);
    firstTick = false;
    if (container) {
      container.innerHTML = renderScanItems(displayItems, state.scanIndex, wrappedOnSelect, colorMap, iconMap, context, showIcons);
      container.querySelectorAll(".scan-item").forEach((el, i) => {
        el.classList.toggle("active", i === state.scanIndex);
        addBlinkProgress(el, 0);
      });
      if (typeof lucide !== "undefined") lucide.createIcons({ root: container });
      runCountdownUpdate();
    }
    state.lastShownScanIndex = state.scanIndex;
    state.scanIndex = (state.scanIndex + 1) % displayItems.length;
  }

  function startCountdown() {
    state.scanTickStart = Date.now();
    state.scanTickDuration = scanDuration;
    state.scanInterval = setInterval(tick, scanDuration);
  }

  if (container) {
    container.innerHTML = renderScanItems(displayItems, 0, wrappedOnSelect, colorMap, iconMap, context, showIcons);
    container.querySelectorAll(".scan-item").forEach((el, i) => {
      el.classList.toggle("active", i === 0);
      addBlinkProgress(el, 0);
    });
    if (typeof lucide !== "undefined") lucide.createIcons({ root: container });
    runCountdownUpdate();
  }

  if (useVoice) {
    speakFirstAndWaitUntilStarted(firstLabel).then(startCountdown);
  } else {
    startCountdown();
  }
}

function stopScan() {
  if (state.scanInterval) { clearInterval(state.scanInterval); state.scanInterval = null; }
  state.lastShownScanIndex = undefined;
}

function runCountdownUpdate() {
  if (!state.scanInterval || state.paused) return;
  const duration = state.scanTickDuration || 5000;
  const remainingMs = Math.max(0, duration - (Date.now() - state.scanTickStart));
  const remainingSec = Math.ceil(remainingMs / 1000);
  const timingText = remainingSec > 0 ? `${remainingSec}s` : "";
  const badgeText = remainingSec > 0 ? `${remainingSec}s` : "";
  const dwellRemaining = duration > 0 ? remainingMs / duration : 0;
  const activeScreen = document.querySelector(".screen.active");
  if (activeScreen) {
    activeScreen.querySelectorAll(".scan-item.active").forEach(el => {
      el.style.setProperty("--dwell-remaining", String(dwellRemaining));
      const timing = el.querySelector(".scan-item-timing");
      if (timing) timing.textContent = timingText;
    });
    activeScreen.querySelectorAll(".quick-half.active").forEach(el => {
      el.style.setProperty("--dwell-remaining", String(dwellRemaining));
      const countdown = el.querySelector(".scan-item-countdown");
      if (countdown) countdown.textContent = badgeText;
    });
  }
}

function addBlinkProgress(el, progress) {
  if (!el) return;
  el.style.setProperty("--blink-progress", Math.min(1, progress));
  el.classList.toggle("blink-in-progress", progress > 0 && progress < 1);
}

/** Go to the landing/starting screen (face_ready): quiet, no scan. Use for "Back to home" and "Back to starting screen". */
function goToLanding() {
  stopScan();
  state.onScanSelect = null;
  state.scanItems = null;
  state.navStack = [];
  state.summaryBlinkCount = 0;
  showScreen("face_ready");
  renderDailySummaryLanding();
}

function goHome() {
  state.navStack = [];
  state.summaryBlinkCount = 0;
  showScreen("home");
  renderDailySummaryHome();
  const cfg = state.config || { boards: {}, navigation_root: { scan_order: [] } };
  const boards = cfg.boards || {};
  const order = cfg.navigation_root?.scan_order || ["urgent_needs", "comfort_care", "spelling", "quick_yes_no"];

  const builtIn = {
    urgent_needs: { label: "Urgent needs", id: "urgent", color: "red", boardKey: "board_2_urgent" },
    comfort_care: { label: "Comfort and care", id: "comfort", color: "green", boardKey: "board_3_comfort" },
    spelling: { label: "Spell a word", id: "spelling", color: "blue" },
    quick_yes_no: { label: "Quick yes or no", id: "quick", color: "orange" }
  };

  const ordered = order.map(sid => {
    if (builtIn[sid]) return builtIn[sid];
    const b = boards[sid];
    if (b && b.label) return { label: b.label, id: sid, color: b.color || "white", boardKey: sid };
    return null;
  }).filter(Boolean);

  const container = document.getElementById("home-items");
  const colorMap = ordered.map(x => COLORS[x.color] || COLORS.white);
  startScan(ordered, (label, item) => {
    stopScan();
    const it = item || {};
    if (it.boardKey) {
      state.contentBoard = boards[it.boardKey] || boards[it.id];
      if (state.contentBoard) showSectionSelect();
    } else if (it.id === "urgent") {
      state.contentBoard = boards.board_2_urgent || content?.boards?.board_2_urgent;
      showSectionSelect();
    } else if (it.id === "comfort") {
      state.contentBoard = boards.board_3_comfort || content?.boards?.board_3_comfort;
      showSectionSelect();
    } else if (it.id === "spelling") showSpelling();
    else if (it.id === "quick") showQuickYesNo(null);
  }, { container, screenId: "home", colorMap, showIcons: false });
}

function getSectionContext() {
  const lbl = state.contentBoard?.label || "";
  return lbl.toLowerCase().includes("urgent") ? "urgent" : lbl.toLowerCase().includes("comfort") ? "comfort" : null;
}

function showSectionSelect() {
  state.navStack.push({ screen: state.screen, data: state.contentBoard });
  showScreen("section");
  document.getElementById("section-title").textContent = state.contentBoard?.label || "";
  const groups = state.contentBoard?.groups || [];
  const items = groups.map(g => ({ ...g, label: g.label, color: g.color }));
  items.push({ label: BACK_ONE_LEVEL_LABEL, color: "red" });
  const colors = items.map(i => COLORS[i.color] || null);
  const container = document.getElementById("section-items");
  startScan(items, (label, item) => {
    stopScan();
    const it = item || {};
    if (it.label === BACK_ONE_LEVEL_LABEL) { state.navStack.pop(); goHome(); return; }
    state.currentGroup = it;
    const groupItems = it.items || [];
    if (groupItems.length === 0) {
      state.navStack.push({ screen: "items", emptyGroup: true });
      showConfirmation(it.label);
      return;
    }
    showItemList(groupItems);
  }, { container, screenId: "section", colorMap: colors, context: getSectionContext(), showIcons: false });
}

function getItemLabel(item) {
  return typeof item === "string" ? item : (item?.label || String(item));
}

function hasSubItems(item) {
  return typeof item === "object" && item && Array.isArray(item.subItems) && item.subItems.length > 0;
}

function showItemList(groupItems) {
  state.navStack.push({ screen: "section", data: null });
  const all = (groupItems || []).filter(x => x !== BACK_ONE_LEVEL_LABEL);
  const pages = [];
  for (let i = 0; i < all.length; i += config.max_items_per_page) {
    pages.push(all.slice(i, i + config.max_items_per_page));
  }
  state.itemPages = pages;
  state.itemPage = 0;
  state.pendingParent = null;
  renderItemPage();
}

function showSubItemList(parentLabel, subItems) {
  state.itemListParentGroup = state.currentGroup;
  state.navStack.push({ screen: "items", parentLabel });
  state.itemPages = [subItems];
  state.itemPage = 0;
  state.pendingParent = parentLabel;
  state.currentGroup = { ...state.currentGroup, label: parentLabel + " — Where?" };
  renderItemPage();
}

function renderItemPage() {
  showScreen("items");
  document.getElementById("items-title").textContent = state.currentGroup?.label || "";
  const page = state.itemPages[state.itemPage] || [];
  const items = [];
  if (state.itemPages.length > 1) {
    if (state.itemPage > 0) items.push("PREV PAGE");
    items.push(...page);
    if (state.itemPage < state.itemPages.length - 1) items.push("NEXT PAGE");
  } else {
    items.push(...page);
  }
  items.push(BACK_ONE_LEVEL_LABEL);
  const groupColor = state.currentGroup?.color ? COLORS[state.currentGroup.color] : null;
  const container = document.getElementById("items-list");
  const pagination = document.getElementById("items-pagination");
  pagination.innerHTML = state.itemPages.length > 1 ? `Page ${state.itemPage + 1} of ${state.itemPages.length}` : "";
  const pageStartInItems = state.itemPages.length > 1 && state.itemPage > 0 ? 1 : 0;
  const colorMap = items.map((it, i) => (it === BACK_ONE_LEVEL_LABEL || it === "PREV PAGE" || it === "NEXT PAGE") ? COLORS.red : groupColor);
  const groupIconName = getIconName(state.currentGroup, state.currentGroup?.label, getSectionContext());
  const iconMap = items.map(it => (it === BACK_ONE_LEVEL_LABEL || it === "PREV PAGE" || it === "NEXT PAGE") ? null : groupIconName);
  startScan(items, (label, rawItem) => {
    stopScan();
    if (label === BACK_ONE_LEVEL_LABEL) {
      state.navStack.pop();
      if (state.itemPage > 0) { state.itemPage--; renderItemPage(); }
      else if (state.pendingParent) {
        state.pendingParent = null;
        const parent = state.itemListParentGroup;
        state.currentGroup = parent;
        if (parent?.items) showItemList(parent.items);
        else showSectionSelect();
      } else {
        showSectionSelect();
      }
      return;
    }
    if (label === "PREV PAGE") { state.itemPage--; renderItemPage(); return; }
    if (label === "NEXT PAGE") { state.itemPage++; renderItemPage(); return; }
    const fullList = state.itemPages.flat();
    const idx = items.findIndex(it => getItemLabel(it) === label);
    if (idx >= 0) {
      const pageIdx = idx - pageStartInItems;
      if (pageIdx >= 0 && pageIdx < page.length) {
        const selected = fullList[state.itemPage * config.max_items_per_page + pageIdx];
        if (hasSubItems(selected)) {
          showSubItemList(getItemLabel(selected), selected.subItems);
        } else {
          const finalLabel = state.pendingParent ? state.pendingParent + " → " + getItemLabel(selected) : getItemLabel(selected);
          state.pendingConfirm = finalLabel;
          showConfirmation(finalLabel);
        }
      }
    }
  }, { container, screenId: "items", colorMap, iconMap, showIcons: false });
}

function showConfirmation(item) {
  stopScan();
  state.onScanSelect = null;
  state.scanItems = null;
  showScreen("confirm");
  document.getElementById("confirm-item").textContent = item;
  const opts = [{ label: "Yes, that's right", color: "green" }, { label: "No, go back", color: "red" }];
  const container = document.getElementById("confirm-options");
  const step4Phrase = "You have selected \u201C" + item + "\u201D";
  const startConfirmScan = () => {
    startScan(opts, (label) => {
      stopScan();
      if (label.startsWith("Yes")) {
        logEvent(item);
        state.lastSelection = item;
        showAnythingElse();
      } else {
        const popped = state.navStack.pop();
        if (popped?.emptyGroup) showSectionSelect();
        else renderItemPage();
      }
    }, { container, screenId: "confirm", colorMap: [COLORS.green, COLORS.red], showIcons: true });
  };
  if (config.auditory_scanning && !isModalOpen()) {
    speakAndWaitUntilEnded(step4Phrase).then(startConfirmScan);
  } else {
    startConfirmScan();
  }
}

function showAnythingElse() {
  showScreen("anything-else");
  const lastEl = document.getElementById("anything-else-last");
  if (lastEl) lastEl.textContent = state.lastSelection ? `Last request: ${state.lastSelection}` : "";
  const opts = [
    { label: "I need something else", color: "green" },
    { label: "I'm finished", color: "blue" }
  ];
  const container = document.getElementById("anything-else-options");
  startScan(opts, (label) => {
    stopScan();
    if (label === "I need something else") goHome();
    else showSummary();
  }, { container, screenId: "anything-else", colorMap: [COLORS.green, COLORS.blue], showIcons: true });
}

function showSpelling() {
  state.navStack.push({ screen: "home" });
  state.spellingWord = "";
  const board = (state.config?.boards || content?.boards || {}).board_1_spelling;
  state.spellingBoard = board;
  showScreen("spelling");
  spellingScanRows();
}

function spellingScanRows() {
  document.getElementById("word-strip").textContent = state.spellingWord || "(building word)";
  document.getElementById("spelling-row-label").textContent = "Select row";
  const rows = state.spellingBoard.rows;
  const backRow = { id: "go_back", label: BACK_ONE_LEVEL_LABEL, color: "red", items: [] };
  const rowsWithBack = [...rows, backRow];
  const container = document.getElementById("spelling-row-items");
  const colorMap = rowsWithBack.map(r => COLORS[r.color]);
  startScan(rowsWithBack, (label, row) => {
    stopScan();
    const r = row || {};
    if (r.id === "go_back") {
      state.navStack.pop();
      goHome();
      return;
    }
    if (r.id === "controls") {
      const controlItems = [...r.items, BACK_ONE_LEVEL_SPELLING];
      startScan(controlItems, (label2) => {
        stopScan();
        if (label2 === BACK_ONE_LEVEL_SPELLING) {
          spellingScanRows();
          return;
        }
        handleSpellingControl(label2);
      }, { container, screenId: "spelling", colorMap: controlItems.map(() => COLORS[r.color]), showIcons: false });
    } else {
      document.getElementById("spelling-row-label").textContent = "Row: " + r.label;
      const letterItems = [...r.items, BACK_ONE_LEVEL_SPELLING];
      startScan(letterItems, (label2) => {
        stopScan();
        if (label2 === BACK_ONE_LEVEL_SPELLING) {
          spellingScanRows();
          return;
        }
        state.spellingWord += label2;
        spellingScanRows();
      }, { container, screenId: "spelling", colorMap: letterItems.map(() => COLORS[r.color]), showIcons: false });
    }
  }, { container, screenId: "spelling", colorMap, showIcons: false });
}

function handleSpellingControl(cmd) {
  if (cmd === "WRONG / DELETE") {
    if (state.spellingWord.length === 0) {
      spellingScanRows();
      return;
    }
    state.pendingSpellingDelete = true;
    showSpellingDeleteConfirm();
    return;
  }
  if (cmd === "SPACE") {
    state.spellingWord += " ";
  } else if (cmd === "CONFIRM WORD") {
    if (state.spellingWord.trim()) {
      logEvent(state.spellingWord.trim());
      state.lastSelection = state.spellingWord.trim();
      state.spellingWord = "";
      showAnythingElse();
      return;
    }
  } else if (cmd === "FINISH MESSAGE") {
    if (state.spellingWord.trim()) logEvent(state.spellingWord.trim());
    showAnythingElse();
    return;
  }
  spellingScanRows();
}

function showSpellingDeleteConfirm() {
  const char = state.spellingWord.slice(-1) || "character";
  const container = document.getElementById("spelling-row-items");
  document.getElementById("spelling-row-label").textContent = `Delete "${char}"?`;
  const opts = [{ label: "NO — cancel", color: "red" }, { label: "YES — delete", color: "green" }];
  startScan(opts, (label) => {
    stopScan();
    state.pendingSpellingDelete = false;
    if (label.startsWith("YES")) state.spellingWord = state.spellingWord.slice(0, -1);
    spellingScanRows();
  }, { container, screenId: "spelling", colorMap: [COLORS.red, COLORS.green], showIcons: false });
}

function showQuickYesNo(returnScreen) {
  state.quickYesNoReturnScreen = returnScreen || "home";
  showScreen("quick-yes-no");
  const opts = [{ label: "NO" }, { label: "YES" }];
  const noEl = document.getElementById("quick-no");
  const yesEl = document.getElementById("quick-yes");
  noEl.innerHTML = `<span class="scan-item-countdown quick-countdown"></span><i data-lucide="thumbs-down" class="quick-half-icon"></i><span>NO</span>`;
  yesEl.innerHTML = `<span class="scan-item-countdown quick-countdown"></span><i data-lucide="thumbs-up" class="quick-half-icon"></i><span>YES</span>`;
  noEl.classList.add("scan-item");
  yesEl.classList.add("scan-item");
  noEl.dataset.index = "0";
  yesEl.dataset.index = "1";
  if (typeof lucide !== "undefined") lucide.createIcons({ root: document.getElementById("screen-quick-yes-no") });
  state.scanItems = opts;
  state.onScanSelect = (label) => {
    stopScan();
    noEl.classList.remove("scan-item", "active");
    yesEl.classList.remove("scan-item", "active");
    logEvent(label);
    state.lastSelection = label;
    showScreen("confirm");
    document.getElementById("confirm-item").textContent = "You said: " + label;
    document.getElementById("confirm-options").innerHTML = "";
    setTimeout(() => {
      if (state.quickYesNoReturnScreen === "face_ready") showScreen("face_ready");
      else goHome();
    }, 2000);
  };
  state.scanIndex = 0;
  const both = [noEl, yesEl];
  const scanDuration = getScanDurationMs();
  function tick() {
    if (state.paused || state.screen !== "quick-yes-no") return;
    if (state.blinkStart > 0) return;
    state.scanTickStart = Date.now();
    state.scanTickDuration = scanDuration;
    both.forEach((el, i) => { el.classList.toggle("active", i === state.scanIndex); addBlinkProgress(el, 0); });
    if (config.auditory_scanning && !isModalOpen()) speak(opts[state.scanIndex].label);
    runCountdownUpdate();
    state.scanIndex = (state.scanIndex + 1) % 2;
  }
  tick();
  state.scanInterval = setInterval(tick, scanDuration);
}

const ROOT_MAX = 6;
const SECTION_GROUP_MAX = 6;
const ITEMS_PER_GROUP_MAX = 6;
const FIXED_ROOT_IDS = ["spelling", "quick_yes_no"];
const NAV_TO_BOARD = { urgent_needs: "board_2_urgent", comfort_care: "board_3_comfort" };

const BUILT_IN_ROOT_LABELS = {
  urgent_needs: "Urgent needs",
  comfort_care: "Comfort and care",
  spelling: "Spell a word",
  quick_yes_no: "Quick yes or no"
};

/**
 * Patient-options architecture view (read-only).
 * Previous equal-width columns flattened hierarchy and gave secondary branches (Spell a word, Yes/No) the same weight as primary care (Urgent needs, Comfort and care). This version: (1) splits into a dominant primary canvas (left/centre) and a narrow secondary strip (right), (2) renders a true recursive tree with connector lines and depth-based weight, (3) supports unlimited nesting from the source data.
 */
/** Primary editable care architecture: dominant in layout. */
const ARCH_PRIMARY_NAV_IDS = ["urgent_needs", "comfort_care"];
/** Secondary/utility branches: narrower, quieter, far right. */
const ARCH_SECONDARY_NAV_IDS = ["spelling", "quick_yes_no"];

/** Normalize any node shape to { label, children[] } for recursive rendering. Supports unlimited depth. */
function normalizeToArchNode(node) {
  if (!node || node.label === undefined) return { label: "", children: [] };
  if (node.leaf) return { label: node.label, children: [] };
  if (Array.isArray(node.items)) {
    return {
      label: node.label,
      children: node.items.map(it => ({ label: typeof it === "string" ? it : (it?.label || ""), children: [] }))
    };
  }
  const children = (node.children || []).map(normalizeToArchNode).filter(n => n.label !== undefined);
  return { label: node.label, children };
}

/** Build primary and secondary trees from config. Returns { primary: ArchNode[], secondary: ArchNode[] }. */
function buildArchTrees() {
  const cfg = state.config || { boards: {}, navigation_root: { scan_order: [] } };
  const boards = cfg.boards || {};
  const navOrder = cfg.navigation_root?.scan_order || ["urgent_needs", "comfort_care", "spelling", "quick_yes_no"];
  const primary = [];
  const secondary = [];

  function addBoardNode(navId, list) {
    const title = BUILT_IN_ROOT_LABELS[navId] || boards[navId]?.label || navId;
    const boardKey = getBoardKey(navId);
    const board = boards[boardKey] || content?.boards?.[boardKey];

    if (navId === "spelling" && board?.rows) {
      const children = board.rows.map(row => {
        const rowLabel = row.label || row.id || "Row";
        const items = (row.items || []).map(it => (typeof it === "string" ? it : it?.label || String(it)));
        return normalizeToArchNode({ label: rowLabel, items });
      });
      list.push(normalizeToArchNode({ label: title, children }));
      return;
    }

    if (navId === "quick_yes_no") {
      list.push(normalizeToArchNode({
        label: title,
        children: [{ label: "No", children: [] }, { label: "Yes", children: [] }]
      }));
      return;
    }

    if (!board?.groups) {
      list.push({ label: title, children: [] });
      return;
    }

    const boardChildren = board.groups.map(group => {
      const groupLabel = group.label || group.id || "Group";
      const itemNodes = (group.items || []).map(item => {
        const itemLabel = typeof item === "string" ? item : (item?.label || "");
        if (typeof item === "object" && item && Array.isArray(item.subItems) && item.subItems.length > 0) {
          const subLabels = item.subItems.map(s => (typeof s === "string" ? s : s?.label || ""));
          return normalizeToArchNode({ label: itemLabel, items: subLabels });
        }
        return { label: itemLabel, children: [] };
      });
      return normalizeToArchNode({ label: groupLabel, children: itemNodes });
    });
    list.push(normalizeToArchNode({ label: title, children: boardChildren }));
  }

  ARCH_PRIMARY_NAV_IDS.forEach(id => { if (navOrder.includes(id)) addBoardNode(id, primary); });
  ARCH_SECONDARY_NAV_IDS.forEach(id => { if (navOrder.includes(id)) addBoardNode(id, secondary); });
  navOrder.forEach(id => {
    if (ARCH_PRIMARY_NAV_IDS.includes(id) || ARCH_SECONDARY_NAV_IDS.includes(id)) return;
    addBoardNode(id, primary);
  });

  return { primary, secondary };
}

/** Reusable hierarchy view: one branch (node + connector stalk + children). Renders recursively for unlimited depth. */
function renderArchBranch(node, depth, zone) {
  const depthClass = `arch-d${Math.min(depth, 4)}`;
  const zoneClass = zone === "secondary" ? " arch-secondary" : "";
  const card = `<div class="arch-node ${depthClass}${zoneClass}" role="treeitem" aria-level="${depth + 1}">${escapeHtml(node.label)}</div>`;
  if (!node.children || node.children.length === 0) return card;

  const childrenHtml = node.children.map((child, i) => {
    const isLast = i === node.children.length - 1;
    const branchHtml = renderArchBranch(child, depth + 1, zone);
    return `<div class="arch-child" data-last="${isLast}">${branchHtml}</div>`;
  }).join("");

  return `<div class="arch-branch" role="group" aria-label="${escapeHtml(node.label)}">
    ${card}
    <div class="arch-stalk"></div>
    <div class="arch-children">${childrenHtml}</div>
  </div>`;
}

function renderSiteMapTree(containerEl) {
  if (!containerEl) return;
  const { primary, secondary } = buildArchTrees();
  const primaryHtml = primary.length
    ? primary.map(n => renderArchBranch(n, 0, "primary")).join("")
    : "";
  const secondaryHtml = secondary.length
    ? secondary.map(n => renderArchBranch(n, 0, "secondary")).join("")
    : "";
  containerEl.innerHTML = `
    <div class="arch-canvas">
      <div class="arch-canvas-primary" role="tree" aria-label="Primary care options">${primaryHtml}</div>
      <div class="arch-canvas-secondary" role="tree" aria-label="Utility options">${secondaryHtml}</div>
    </div>`;
}

function openSiteMapModal() {
  const modal = document.getElementById("sitemap-modal");
  const treeEl = document.getElementById("sitemap-tree");
  if (modal && treeEl) {
    renderSiteMapTree(treeEl);
    modal.classList.remove("hidden");
  }
}

function closeSiteMapModal() {
  document.getElementById("sitemap-modal")?.classList.add("hidden");
}

function getBoardKey(navId) {
  return NAV_TO_BOARD[navId] || navId;
}

function customizeRenameAt(path, index, currentLabel) {
  const draft = state.customizeDraft;
  const boards = draft?.boards || {};
  const nav = draft?.navigation_root || {};
  const newLabel = prompt("Rename:", currentLabel || "");
  if (newLabel == null || String(newLabel).trim() === "") return;
  const trimmed = String(newLabel).trim();
  if (path.length === 0) {
    const order = nav.scan_order || [];
    const sid = order[index];
    if (!sid) return;
    const boardKey = getBoardKey(sid);
    const board = boards[boardKey] || content?.boards?.[boardKey] || { label: "", groups: [] };
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, label: trimmed } };
  } else if (path.length === 1) {
    const boardKey = path[0];
    const board = state.customizeDraft?.boards?.[boardKey] || content?.boards?.[boardKey] || { groups: [] };
    const groups = [...(board.groups || [])];
    if (groups[index]) groups[index] = { ...groups[index], label: trimmed };
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups } };
  } else if (path.length === 2) {
    const [boardKey, groupIdx] = path;
    const board = state.customizeDraft?.boards?.[boardKey] || content?.boards?.[boardKey] || { groups: [] };
    const group = (board.groups || [])[groupIdx] || { items: [] };
    const items = [...(group.items || [])];
    const it = items[index];
    if (typeof it === "string") items[index] = trimmed;
    else if (it && typeof it === "object") items[index] = { ...it, label: trimmed };
    const newGroups = [...(board.groups || [])];
    newGroups[groupIdx] = { ...group, items };
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
  } else if (path.length === 3) {
    const [boardKey, groupIdx, itemIdx] = path;
    const board = state.customizeDraft?.boards?.[boardKey] || content?.boards?.[boardKey] || { groups: [] };
    const group = (board.groups || [])[groupIdx] || { items: [] };
    const item = (group.items || [])[itemIdx];
    const subItems = (typeof item === "object" && item?.subItems) ? [...item.subItems] : [];
    const s = subItems[index];
    if (typeof s === "string") subItems[index] = trimmed;
    else if (s && typeof s === "object") subItems[index] = { ...s, label: trimmed };
    const newItems = [...(group.items || [])];
    const updatedItem = typeof item === "object" ? { ...item, subItems } : { label: item, subItems };
    newItems[itemIdx] = updatedItem;
    const newGroups = [...(board.groups || [])];
    newGroups[groupIdx] = { ...group, items: newItems };
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
  }
  renderCustomizeView();
}

function openCustomizeModal() {
  state.customizeDraft = JSON.parse(JSON.stringify(state.config || { boards: {}, navigation_root: { scan_order: [] } }));
  state.customizePath = [];
  document.getElementById("customize-modal").classList.remove("hidden");
  renderCustomizeView();
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function showCustomizeSavedHint(message) {
  const footer = document.querySelector("#customize-modal .customize-footer");
  if (!footer) return;
  const existing = footer.querySelector(".customize-saved-hint");
  if (existing) existing.remove();
  const hint = document.createElement("span");
  hint.className = "customize-saved-hint";
  hint.textContent = message || "Saved on this device.";
  hint.style.cssText = "margin-left:14px;color:var(--success);font-size:15px;font-weight:500;";
  footer.appendChild(hint);
  setTimeout(() => hint.remove(), 2000);
}

function customizeNavigateTo(path) {
  state.customizePath = path;
  renderCustomizeView();
}

function renderCustomizeView() {
  const draft = state.customizeDraft || state.config;
  const boards = draft?.boards || {};
  const nav = draft?.navigation_root || {};
  const path = state.customizePath || [];
  const list = document.getElementById("customize-list");
  const helpEl = document.getElementById("customize-help");
  const addBtn = document.getElementById("btn-customize-add");
  const addGroupBtn = document.getElementById("btn-customize-add-group");
  const breadcrumb = document.getElementById("customize-breadcrumb");

  function crumbKeyToPath(k) {
    if (k === undefined || k === null || k === "") return [];
    const parts = k.split("\x1e");
    if (parts.length === 1) return [parts[0]];
    const p = [parts[0]];
    if (parts[1] !== undefined) p.push(parseInt(parts[1], 10));
    if (parts[2] !== undefined) p.push(parseInt(parts[2], 10));
    return p;
  }

  function breadcrumbHtml() {
    const parts = [];
    parts.push(`<span class="crumb" data-crumb="">Main screen</span>`);
    if (path.length >= 1) {
      const boardKey = path[0];
      const board = boards[boardKey] || content?.boards?.[boardKey];
      const boardLabel = board?.label || boardKey;
      parts.push(`<span class="sep">›</span>`);
      if (path.length === 1) {
        parts.push(`<span class="crumb-current">${escapeHtml(boardLabel)}</span>`);
      } else {
        parts.push(`<span class="crumb" data-crumb="${escapeHtml(boardKey)}">${escapeHtml(boardLabel)}</span>`);
      }
    }
    if (path.length >= 2) {
      const boardKey = path[0];
      const groupIdx = path[1];
      const board = boards[boardKey] || content?.boards?.[boardKey];
      const group = (board?.groups || [])[groupIdx];
      const groupLabel = group?.label || `Group ${groupIdx + 1}`;
      parts.push(`<span class="sep">›</span>`);
      if (path.length === 2) {
        parts.push(`<span class="crumb-current">${escapeHtml(groupLabel)}</span>`);
      } else {
        parts.push(`<span class="crumb" data-crumb="${escapeHtml(boardKey + "\x1e" + groupIdx)}">${escapeHtml(groupLabel)}</span>`);
      }
    }
    if (path.length >= 3) {
      const boardKey = path[0];
      const groupIdx = path[1];
      const itemIdx = path[2];
      const board = boards[boardKey] || content?.boards?.[boardKey];
      const group = (board?.groups || [])[groupIdx];
      const item = (group?.items || [])[itemIdx];
      const itemLabel = typeof item === "string" ? item : item?.label || `Item ${itemIdx + 1}`;
      parts.push(`<span class="sep">›</span>`);
      parts.push(`<span class="crumb-current">${escapeHtml(itemLabel)}</span>`);
    }
    return parts.join("");
  }

  breadcrumb.innerHTML = breadcrumbHtml();
  breadcrumb.querySelectorAll(".crumb[data-crumb]").forEach(el => {
    el.addEventListener("click", () => {
      const k = el.getAttribute("data-crumb");
      const p = crumbKeyToPath(k);
      customizeNavigateTo(p);
    });
  });

  if (path.length === 0) {
    const order = nav.scan_order || ["urgent_needs", "comfort_care", "spelling", "quick_yes_no"];
    const builtInLabels = { urgent_needs: "Urgent needs", comfort_care: "Comfort and care", spelling: "Spell a word", quick_yes_no: "Quick yes or no" };
    helpEl.textContent = "Main categories on home screen. Click a category to add or edit its contents. Up to 6. Drag to reorder. Spelling and Quick yes/no are fixed.";
    addBtn.textContent = "+ Add new item";
    addBtn.disabled = order.length >= ROOT_MAX;
    if (addGroupBtn) { addGroupBtn.textContent = "+ Add new group"; addGroupBtn.classList.remove("hidden"); addGroupBtn.disabled = order.length >= ROOT_MAX; }
    const isBoard = (sid) => !FIXED_ROOT_IDS.includes(sid) && (NAV_TO_BOARD[sid] || boards[sid]);
    list.innerHTML = order.map((sid, index) => {
      const label = builtInLabels[sid] || boards[sid]?.label || sid;
      const fixed = FIXED_ROOT_IDS.includes(sid);
      const canEnter = isBoard(sid);
      const openBtn = canEnter ? `<button type="button" class="tile-open" data-id="${escapeHtml(sid)}">Open ›</button>` : "";
      const removeBtn = fixed ? "" : `<button type="button" class="tile-remove" data-id="${escapeHtml(sid)}" aria-label="Remove">\u2715</button>`;
      const renameBtn = `<button type="button" class="tile-rename" data-index="${index}" aria-label="Rename" title="Rename">Edit</button>`;
      return `<li data-id="${escapeHtml(sid)}" data-index="${index}" data-enter="${canEnter}" draggable="${!fixed}" ${fixed ? 'data-fixed="1"' : ""}>
        <span class="drag-handle" aria-hidden="true">\u2630</span>
        <span class="tile-label">${escapeHtml(label)}</span>
        ${renameBtn}
        ${openBtn}
        ${removeBtn}
      </li>`;
    }).join("");
    list.querySelectorAll(".tile-open").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sid = btn.dataset.id;
        const boardKey = getBoardKey(sid);
        customizeNavigateTo([boardKey]);
      });
    });
    list.querySelectorAll(".tile-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!id || FIXED_ROOT_IDS.includes(id)) return;
        const order = (state.customizeDraft?.navigation_root?.scan_order || []).filter(x => x !== id);
        state.customizeDraft.navigation_root = { ...state.customizeDraft.navigation_root, scan_order: order };
        if (state.customizeDraft.boards) delete state.customizeDraft.boards[id];
        renderCustomizeView();
      });
    });
    list.querySelectorAll(".tile-rename").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index, 10);
        if (isNaN(index)) return;
        const order = nav.scan_order || [];
        const sid = order[index];
        const label = builtInLabels[sid] || boards[sid]?.label || sid;
        customizeRenameAt([], index, label);
      });
    });
  } else if (path.length === 1) {
    const boardKey = path[0];
    const board = boards[boardKey] || content?.boards?.[boardKey] || { label: "", groups: [] };
    const groups = [...(board.groups || [])];
    helpEl.textContent = "Sub-categories. Click one to add or edit items inside. Up to 6.";
    addBtn.textContent = "+ Add new item";
    addBtn.disabled = groups.length >= SECTION_GROUP_MAX;
    if (addGroupBtn) { addGroupBtn.textContent = "+ Add new group"; addGroupBtn.classList.remove("hidden"); addGroupBtn.disabled = groups.length >= SECTION_GROUP_MAX; }
    list.innerHTML = groups.map((g, i) => `
      <li data-index="${i}" data-id="${escapeHtml(g.id || "")}" data-enter="true" draggable="true">
        <span class="drag-handle" aria-hidden="true">\u2630</span>
        <span class="tile-label">${escapeHtml(g.label || "")}</span>
        <button type="button" class="tile-rename" data-index="${i}" aria-label="Rename" title="Rename">Edit</button>
        <button type="button" class="tile-open" data-index="${i}">Open ›</button>
        <button type="button" class="tile-remove" data-index="${i}" aria-label="Remove">\u2715</button>
      </li>`).join("");
    list.querySelectorAll(".tile-open").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        customizeNavigateTo([boardKey, parseInt(btn.dataset.index, 10)]);
      });
    });
    list.querySelectorAll(".tile-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (isNaN(idx)) return;
        const newGroups = groups.filter((_, i) => i !== idx);
        if (newGroups.length === 0) return;
        state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
        renderCustomizeView();
      });
    });
    list.querySelectorAll(".tile-rename").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (isNaN(idx)) return;
        const g = groups[idx];
        customizeRenameAt([boardKey], idx, g?.label || "");
      });
    });
  } else if (path.length === 2) {
    const [boardKey, groupIdx] = path;
    const board = boards[boardKey] || content?.boards?.[boardKey] || { groups: [] };
    const group = (board.groups || [])[groupIdx] || { items: [] };
    const items = [...(group.items || [])];
    helpEl.textContent = "Selectable items. Items with › have sub-options — click to edit them. Up to 6 each.";
    addBtn.textContent = "+ Add new item";
    addBtn.disabled = items.length >= ITEMS_PER_GROUP_MAX;
    if (addGroupBtn) { addGroupBtn.textContent = "+ Add new group"; addGroupBtn.classList.remove("hidden"); addGroupBtn.disabled = items.length >= ITEMS_PER_GROUP_MAX; }
    list.innerHTML = items.map((it, i) => {
      const label = typeof it === "string" ? it : (it?.label || "");
      const hasSub = typeof it === "object" && it && Array.isArray(it.subItems) && it.subItems.length > 0;
      const openBtn = hasSub ? `<button type="button" class="tile-open" data-index="${i}">Open options ›</button>` : "";
      return `<li data-index="${i}" data-enter="${hasSub}" draggable="true">
        <span class="drag-handle" aria-hidden="true">\u2630</span>
        <span class="tile-label">${escapeHtml(label)}</span>
        <button type="button" class="tile-rename" data-index="${i}" aria-label="Rename" title="Rename">Edit</button>
        ${openBtn}
        <button type="button" class="tile-remove" data-index="${i}" aria-label="Remove">\u2715</button>
      </li>`;
    }).join("");
    list.querySelectorAll(".tile-open").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        customizeNavigateTo([boardKey, groupIdx, parseInt(btn.dataset.index, 10)]);
      });
    });
    list.querySelectorAll(".tile-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (isNaN(idx)) return;
        const newItems = items.filter((_, i) => i !== idx);
        const newGroups = [...(board.groups || [])];
        newGroups[groupIdx] = { ...group, items: newItems };
        state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
        renderCustomizeView();
      });
    });
    list.querySelectorAll(".tile-rename").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (isNaN(idx)) return;
        const it = items[idx];
        const label = typeof it === "string" ? it : (it?.label || "");
        customizeRenameAt([boardKey, groupIdx], idx, label);
      });
    });
  } else if (path.length === 3) {
    const [boardKey, groupIdx, itemIdx] = path;
    const board = boards[boardKey] || content?.boards?.[boardKey] || { groups: [] };
    const group = (board.groups || [])[groupIdx] || { items: [] };
    const item = (group.items || [])[itemIdx];
    const subItems = (typeof item === "object" && item?.subItems) ? [...item.subItems] : [];
    const parentLabel = typeof item === "string" ? item : item?.label || "Item";
    helpEl.textContent = `Sub-options for "${parentLabel}". Shown when patient selects the parent. Up to 6.`;
    addBtn.textContent = "+ Add new item";
    addBtn.disabled = subItems.length >= ITEMS_PER_GROUP_MAX;
    if (addGroupBtn) addGroupBtn.classList.add("hidden");
    list.innerHTML = subItems.map((s, i) => `
      <li data-index="${i}" draggable="true">
        <span class="drag-handle" aria-hidden="true">\u2630</span>
        <span class="tile-label">${escapeHtml(typeof s === "string" ? s : s?.label || "")}</span>
        <button type="button" class="tile-rename" data-index="${i}" aria-label="Rename" title="Rename">Edit</button>
        <button type="button" class="tile-remove" data-index="${i}" aria-label="Remove">\u2715</button>
      </li>`).join("");
    list.querySelectorAll(".tile-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (isNaN(idx)) return;
        const newSub = subItems.filter((_, i) => i !== idx);
        const newItems = [...(group.items || [])];
        const updatedItem = typeof item === "object" ? { ...item, subItems: newSub } : { label: item, subItems: newSub };
        newItems[itemIdx] = updatedItem;
        const newGroups = [...(board.groups || [])];
        newGroups[groupIdx] = { ...group, items: newItems };
        state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
        renderCustomizeView();
      });
    });
    list.querySelectorAll(".tile-rename").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (isNaN(idx)) return;
        const s = subItems[idx];
        const label = typeof s === "string" ? s : (s?.label || "");
        customizeRenameAt([boardKey, groupIdx, itemIdx], idx, label);
      });
    });
  }

  addBtn.onclick = () => customizeAddAt(path, draft, boards, nav);
  if (addGroupBtn) {
    if (path.length === 2) {
      addGroupBtn.onclick = () => customizeAddParentItem(path, draft, boards, nav);
    } else if (path.length <= 1) {
      addGroupBtn.onclick = () => customizeAddAt(path, draft, boards, nav);
    }
  }
  setupCustomizeDragDrop(list, path, draft, boards, nav);
}

function setupCustomizeDragDrop(list, path, draft, boards, nav) {
  if (!list) return;
  let dragged = null;
  list.querySelectorAll("li[draggable='true']").forEach(li => {
    li.ondragstart = (e) => { dragged = li; li.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; };
    li.ondragend = () => { li.classList.remove("dragging"); dragged = null; };
    li.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragged && dragged !== li) li.classList.add("drag-over"); };
    li.ondragleave = () => li.classList.remove("drag-over");
    li.ondrop = (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      if (!dragged || dragged === li) return;
      const items = [...list.querySelectorAll("li")];
      const fromIdx = items.indexOf(dragged);
      const toIdx = items.indexOf(li);
      if (fromIdx < 0 || toIdx < 0) return;
      if (path.length === 0) {
        const order = [...(draft?.navigation_root?.scan_order || [])];
        const [removed] = order.splice(fromIdx, 1);
        order.splice(toIdx, 0, removed);
        state.customizeDraft.navigation_root = { ...state.customizeDraft.navigation_root, scan_order: order };
      } else if (path.length === 1) {
        const boardKey = path[0];
        const board = state.customizeDraft?.boards?.[boardKey] || { groups: [] };
        const groups = [...(board.groups || [])];
        const [removed] = groups.splice(fromIdx, 1);
        groups.splice(toIdx, 0, removed);
        state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups } };
      } else if (path.length === 2) {
        const [boardKey, groupIdx] = path;
        const board = state.customizeDraft?.boards?.[boardKey] || { groups: [] };
        const group = (board.groups || [])[groupIdx] || { items: [] };
        const itemsArr = [...(group.items || [])];
        const [removed] = itemsArr.splice(fromIdx, 1);
        itemsArr.splice(toIdx, 0, removed);
        const newGroups = [...(board.groups || [])];
        newGroups[groupIdx] = { ...group, items: itemsArr };
        state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
      } else if (path.length === 3) {
        const [boardKey, groupIdx, itemIdx] = path;
        const board = state.customizeDraft?.boards?.[boardKey] || { groups: [] };
        const group = (board.groups || [])[groupIdx] || { items: [] };
        const item = (group.items || [])[itemIdx];
        const subItems = (typeof item === "object" && item?.subItems) ? [...item.subItems] : [];
        const [removed] = subItems.splice(fromIdx, 1);
        subItems.splice(toIdx, 0, removed);
        const newItems = [...(group.items || [])];
        const updatedItem = typeof item === "object" ? { ...item, subItems } : { label: item, subItems };
        newItems[itemIdx] = updatedItem;
        const newGroups = [...(board.groups || [])];
        newGroups[groupIdx] = { ...group, items: newItems };
        state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
      }
      renderCustomizeView();
    };
  });
}

function customizeAddAt(path, draft, boards, nav) {
  if (path.length === 0) {
    const label = prompt("New category label:");
    if (!label || !label.trim()) return;
    const colors = ["red", "green", "blue", "orange", "pink", "yellow", "white"];
    const id = "board_custom_" + Date.now();
    const order = [...(nav?.scan_order || [])];
    if (order.length >= ROOT_MAX) return;
    order.splice(Math.max(0, order.indexOf("spelling")), 0, id);
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [id]: { label: label.trim(), color: colors[order.length % colors.length], groups: [] } };
    state.customizeDraft.navigation_root = { ...state.customizeDraft.navigation_root, scan_order: order };
  } else if (path.length === 1) {
    const label = prompt("New sub-category label:");
    if (!label || !label.trim()) return;
    const boardKey = path[0];
    const board = state.customizeDraft?.boards?.[boardKey] || content?.boards?.[boardKey] || { groups: [] };
    const groups = [...(board.groups || []), { id: "group_" + Date.now(), label: label.trim(), color: "white", items: [] }];
    if (groups.length > SECTION_GROUP_MAX) return;
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups } };
  } else if (path.length === 2) {
    const label = prompt("New item label:");
    if (!label || !label.trim()) return;
    const boardKey = path[0];
    const groupIdx = path[1];
    const board = state.customizeDraft?.boards?.[boardKey] || { groups: [] };
    const group = (board.groups || [])[groupIdx] || { items: [] };
    const items = [...(group.items || []), label.trim()];
    if (items.length >= ITEMS_PER_GROUP_MAX) return;
    const newGroups = [...(board.groups || [])];
    newGroups[groupIdx] = { ...group, items };
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
  } else if (path.length === 3) {
    const label = prompt("New sub-option label:");
    if (!label || !label.trim()) return;
    const [boardKey, groupIdx, itemIdx] = path;
    const board = state.customizeDraft?.boards?.[boardKey] || { groups: [] };
    const group = (board.groups || [])[groupIdx] || { items: [] };
    const item = (group.items || [])[itemIdx];
    const subItems = (typeof item === "object" && item?.subItems) ? [...item.subItems] : [];
    if (subItems.length >= ITEMS_PER_GROUP_MAX) return;
    subItems.push(label.trim());
    const newItems = [...(group.items || [])];
    const updatedItem = typeof item === "object" ? { ...item, subItems } : { label: item, subItems };
    newItems[itemIdx] = updatedItem;
    const newGroups = [...(board.groups || [])];
    newGroups[groupIdx] = { ...group, items: newItems };
    state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
  }
  renderCustomizeView();
}

function customizeAddParentItem(path, draft, boards, nav) {
  if (path.length !== 2) return;
  const label = prompt("Parent item label (e.g. 'Arms and elbows'):");
  if (!label || !label.trim()) return;
  const [boardKey, groupIdx] = path;
  const board = state.customizeDraft?.boards?.[boardKey] || { groups: [] };
  const group = (board.groups || [])[groupIdx] || { items: [] };
  const items = [...(group.items || []), { label: label.trim(), subItems: [] }];
  if (items.length >= ITEMS_PER_GROUP_MAX) return;
  const newGroups = [...(board.groups || [])];
  newGroups[groupIdx] = { ...group, items };
  state.customizeDraft.boards = { ...state.customizeDraft.boards, [boardKey]: { ...board, groups: newGroups } };
  customizeNavigateTo([boardKey, groupIdx, items.length - 1]);
}

async function saveCustomize() {
  const cfg = state.customizeDraft;
  if (!cfg) return;
  const toSave = { boards: cfg.boards, navigation_root: cfg.navigation_root };
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("Local save failed:", e.message);
    alert("Could not save on this device. Check storage.");
    return;
  }
  state.config = { ...state.config, ...toSave };
  showCustomizeSavedHint("Saved on this device.");
}

function updateSummaryPatientView() {
  const hist = loadCommunicationHistory();
  const pending = [...hist].filter(e => !e.done).reverse();
  const mostRecent = pending[0] || null;
  const others = pending.slice(1);
  const label = state.lastSelection || (mostRecent && mostRecent.label) || "";
  const time = mostRecent ? mostRecent.time : "";
  const currentBlock = document.getElementById("summary-current-block");
  const saidAtEl = document.getElementById("summary-you-said-at");
  const markDoneEl = document.getElementById("summary-mark-done-current");
  const alsoWrap = document.getElementById("summary-also-waiting-wrap");
  const pendingEl = document.getElementById("summary-pending-list");
  if (currentBlock && saidAtEl) {
    const hasCurrent = !!label;
    currentBlock.classList.toggle("summary-current-empty", !hasCurrent);
    saidAtEl.innerHTML = hasCurrent
      ? `You said at ${time} that "${label}". <span class="summary-status-inline">Status: waiting for caregiver.</span>`
      : "";
  }
  if (markDoneEl) {
    const cb = markDoneEl.querySelector("input[type=checkbox]");
    if (cb && mostRecent) {
      cb.checked = false;
      cb.dataset.id = mostRecent.id;
      markDoneEl.style.display = "flex";
      cb.onchange = () => {
        const id = cb.dataset.id;
        if (id) {
          setHistoryDone(id, cb.checked);
          updateSummaryPatientView();
          renderSummaryRequestCards();
        }
      };
    } else {
      markDoneEl.style.display = "none";
    }
  }
  if (alsoWrap && pendingEl) {
    if (others.length > 0) {
      alsoWrap.classList.remove("summary-also-empty");
      pendingEl.innerHTML = others.map(e => `
        <label class="summary-pending-row" data-id="${escapeHtml(e.id)}">
          <input type="checkbox" aria-label="Mark as done">
          <span class="summary-pending-time">${escapeHtml(e.time)}</span>
          <span class="summary-pending-label">${escapeHtml(e.label)}</span>
        </label>`).join("");
      pendingEl.querySelectorAll("input[type=checkbox]").forEach((input, idx) => {
        const row = input.closest(".summary-pending-row");
        const id = row?.dataset?.id;
        if (!id) return;
        input.onchange = () => {
          setHistoryDone(id, input.checked);
          updateSummaryPatientView();
          renderSummaryRequestCards();
        };
      });
    } else {
      alsoWrap.classList.add("summary-also-empty");
      pendingEl.innerHTML = "";
    }
  }
}

function showSummary() {
  stopScan();
  showScreen("summary");
  state.summaryBlinkCount = 0;
  state.summaryLastBlinkTime = 0;
  renderSummaryRequestCards();
  updateSummaryPatientView();
  updateSummaryBlinkPrompt();
}

function renderSummaryRequestCards() {
  const hist = loadCommunicationHistory();
  const slice = [...hist].reverse().slice(0, SUMMARY_EVENT_MAX_ROWS);
  const pending = slice.filter(e => !e.done);
  const mostRecent = pending[0] || null;
  const latestBlock = document.getElementById("summary-latest-block");
  const latestTime = document.getElementById("summary-latest-time");
  const latestLabel = document.getElementById("summary-latest-label");
  if (latestBlock && latestTime && latestLabel) {
    if (mostRecent) {
      latestBlock.classList.remove("summary-latest-empty");
      latestTime.textContent = mostRecent.time;
      latestLabel.textContent = mostRecent.label;
    } else {
      latestBlock.classList.add("summary-latest-empty");
      latestTime.textContent = "";
      latestLabel.textContent = "";
    }
  }
  const el = document.getElementById("summary-event-log");
  if (!el) return;
  const completed = slice.filter(e => e.done);
  const card = (e) => `
    <div class="summary-request-card ${e.done ? "summary-done" : ""}" data-id="${escapeHtml(e.id)}">
      <span class="summary-card-time">${escapeHtml(e.time)}</span>
      <span class="summary-card-label">${escapeHtml(e.label)}</span>
      <label class="summary-card-done"><input type="checkbox" ${e.done ? "checked" : ""} aria-label="Taken care of"> Done</label>
    </div>`;
  let html = "";
  if (pending.length > 0) {
    html += `<h3 class="summary-section-title">Pending</h3>${pending.map(card).join("")}`;
  }
  if (completed.length > 0) {
    html += `<h3 class="summary-section-title">Completed</h3>${completed.map(card).join("")}`;
  }
  if (!html) html = '<p class="event-empty">No requests yet.</p>';
  if (hist.length > SUMMARY_EVENT_MAX_ROWS) {
    html += `<p class="summary-more-hint">Last ${SUMMARY_EVENT_MAX_ROWS} shown — click Summary in nav for full history.</p>`;
  }
  el.innerHTML = html;
  el.querySelectorAll(".summary-card-done input").forEach(cb => {
    cb.addEventListener("change", () => {
      const cardEl = cb.closest(".summary-request-card");
      const id = cardEl?.dataset?.id;
      if (id) {
        setHistoryDone(id, cb.checked);
        cardEl?.classList.toggle("summary-done", cb.checked);
        renderSummaryRequestCards();
        if (state.screen === "summary") updateSummaryPatientView();
      }
    });
  });
}

function updateSummaryBlinkPrompt() {
  const el = document.getElementById("summary-blink-count");
  if (!el || state.screen !== "summary") return;
  if (state.summaryBlinkCount === 0) {
    el.textContent = "";
  } else {
    el.textContent = `${state.summaryBlinkCount} of 3`;
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  const str = typeof s === "string" ? s : String(s);
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showEmergency() {
  stopScan();
  document.getElementById("screen-emergency").classList.remove("hidden");
  document.getElementById("screen-emergency").classList.add("active");
  playAlarm();
}

function initFaceLandmarker() {
  return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs").then(async ({ FaceLandmarker, FilesetResolver }) => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    state.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1
    });
  });
}

function processFrame() {
  if (state.paused) {
    requestAnimationFrame(processFrame);
    return;
  }
  if (!state.faceLandmarker || !state.video?.readyState) {
    requestAnimationFrame(processFrame);
    return;
  }
  const now = Date.now();
  const timestamp = performance.now();
  const results = state.faceLandmarker.detectForVideo(state.video, timestamp);
  const faceOutline = document.getElementById("face-outline");
  let eyesClosed = false;
  const wasDetected = state.faceDetected;
  state.faceDetected = !!(results.faceLandmarks && results.faceLandmarks[0]);
  if (state.screen === "face_ready") {
    if (!state.faceDetected) faceNotDetectedSeconds += 1 / 60;
    else faceNotDetectedSeconds = 0;
    const shouldShowIdle = !state.faceDetected && faceNotDetectedSeconds >= 10;
    if (state.faceDetected !== wasDetected) {
      updateFaceStatusText();
      updateStatusFaceIcon();
    }
    else if (shouldShowIdle && !idleMessageShown) updateFaceStatusText();
  }

  if (state.faceDetected) {
    faceOutline?.classList.remove("hidden");
    state.faceLostAt = null;
    document.getElementById("face-lost-overlay")?.classList.add("hidden");
    const landmarks = results.faceLandmarks[0];
    const leftEAR = eyeAspectRatio(landmarks, LEFT_EYE);
    const rightEAR = eyeAspectRatio(landmarks, RIGHT_EYE);
    eyesClosed = Math.min(leftEAR, rightEAR) < 0.2;
  } else {
    faceOutline?.classList.add("hidden");
    if (state.screen !== "face_ready" && state.screen !== "emergency") {
      if (!state.faceLostAt) state.faceLostAt = Date.now();
      document.getElementById("face-lost-overlay")?.classList.remove("hidden");
      if (state.faceLostAt && Date.now() - state.faceLostAt >= 180000) {
        stopScan();
        showScreen("face_ready");
        state.faceLostAt = null;
        document.getElementById("face-lost-overlay")?.classList.add("hidden");
      }
    }
  }

  if (eyesClosed) {
    if (state.blinkStart === 0) state.blinkStart = now;
    const duration = now - state.blinkStart;
    if (duration >= config.emergency_blink_ms && !state.calibrationMode) {
      showEmergency();
      state.blinkStart = 0;
      state.cooldownUntil = now + 3000;
      return;
    }
    const threshold = getSelectionBlinkThresholdMs();
    const progress = duration / threshold;
    document.querySelectorAll(".scan-item.active").forEach(el => addBlinkProgress(el, progress));
    if (!state.calibrationMode && duration >= threshold && now > state.cooldownUntil) {
      state.cooldownUntil = now + 1500;
      state.blinkStart = 0;
      document.dispatchEvent(new CustomEvent("blink-select"));
    }
  } else {
    if (state.blinkStart > 0) {
      const blinkDuration = now - state.blinkStart;
      if (state.calibrationMode) handleCalibrationBlink(blinkDuration);
      else if (state.scanInterval) state.scanTickStart += blinkDuration;
    }
    state.blinkStart = 0;
    document.querySelectorAll(".scan-item").forEach(el => addBlinkProgress(el, 0));
  }
  requestAnimationFrame(processFrame);
}

function triggerSelectByIndex(index) {
  if (!state.onScanSelect || !state.scanItems?.length || state.paused) return;
  const items = state.scanItems;
  const idx = (index + items.length) % items.length;
  const item = items[idx];
  const label = typeof item === "string" ? item : (item?.label ?? item);
  stopScan();
  playBeep(1200, 300);
  const cb = state.onScanSelect;
  state.onScanSelect = null;
  if (cb) cb(label, item);
}

document.getElementById("app").addEventListener("click", (e) => {
  if (e.target.closest("input[type=checkbox]")) return;
  const card = e.target.closest(".scan-item[data-index]");
  if (!card) return;
  const idx = parseInt(card.dataset.index, 10);
  if (isNaN(idx)) return;
  if (state.onScanSelect && state.scanItems?.length && !state.paused) triggerSelectByIndex(idx);
});

function updateCameraButton() {
  const btn = document.getElementById("btn-camera-toggle");
  if (!btn) return;
  const isOff = state.paused;
  const icon = btn.querySelector(".btn-camera-icon");
  const label = btn.querySelector(".btn-camera-label");
  if (label) label.textContent = isOff ? "Camera on" : "Camera off";
  btn.title = isOff ? "Turn camera on" : "Turn camera off";
  btn.setAttribute("aria-label", isOff ? "Turn camera on" : "Turn camera off");
  if (icon) {
    icon.setAttribute("data-lucide", isOff ? "video-off" : "video");
    if (typeof lucide !== "undefined") lucide.createIcons({ root: btn });
  }
}

async function unpauseSession() {
  state.paused = false;
  const btn = document.getElementById("btn-pause");
  const patientPause = document.getElementById("btn-pause-patient");
  if (btn) { btn.textContent = "Pause"; btn.classList.remove("paused"); }
  if (patientPause) patientPause.textContent = "Pause";
  document.getElementById("pause-overlay")?.classList.add("hidden");
  try { await startCamera(); } catch (e) { console.warn("Camera restart failed:", e); }
  updateCameraButton();
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  if (state.video) {
    state.video.srcObject = null;
  }
}

document.addEventListener("blink-select", () => {
  if (state.paused) return;
  if (state.screen === "face_ready") {
    state.faceReadyBlinkCount++;
    playBeep(1000 + state.faceReadyBlinkCount * 100, 150);
    updateFaceReadyBlinkHint();
    if (state.faceReadyBlinkCount >= 2) {
      state.faceReadyBlinkCount = 0;
      state.session = [];
      playBeep(1200, 400);
      localStorage.setItem("bedsideblink_calibration", JSON.stringify({ selection_blink_ms: config.selection_blink_ms, calibrationCompleted: state.calibrationCompleted }));
      showScreen("home");
      goHome();
    }
    return;
  }
  if (state.screen === "summary") {
    const now = Date.now();
    if (now - state.summaryLastBlinkTime > state.SUMMARY_BLINK_WINDOW_MS) state.summaryBlinkCount = 0;
    state.summaryLastBlinkTime = now;
    state.summaryBlinkCount++;
    playBeep(1000 + state.summaryBlinkCount * 80, 150);
    updateSummaryBlinkPrompt();
    if (state.summaryBlinkCount >= 3) {
      state.summaryBlinkCount = 0;
      playBeep(1200, 400);
      goHome();
    }
    return;
  }
  if (!state.onScanSelect || !state.scanItems?.length) return;
  playBeep(1200, 300);
  const items = state.scanItems;
  const idx = typeof state.lastShownScanIndex === "number" ? state.lastShownScanIndex : (state.scanIndex - 1 + items.length) % items.length;
  const item = items[idx];
  const label = typeof item === "string" ? item : (item?.label ?? item);
  const cb = state.onScanSelect;
  state.onScanSelect = null;
  if (cb) cb(label, item);
});

async function startCamera() {
  state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
  state.video = document.getElementById("video");
  state.video.srcObject = state.stream;
  await state.video.play();
}

function showInitError(msg) {
  const safeMsg = escapeHtml(String(msg ?? ""));
  const container = document.querySelector(".camera-container");
  if (container) {
    container.innerHTML = `<div style="padding:40px 24px;text-align:center;color:#fca5a5;font-size:18px;line-height:1.6;">${safeMsg}</div>`;
  }
  const instr = document.querySelector(".instruction");
  if (instr) instr.insertAdjacentHTML("afterend", `<p style="color:#fca5a5;font-size:16px;margin-top:12px;">${safeMsg}</p>`);
}

async function init() {
  if (location.protocol === "file:") {
    showInitError("Please run the server: cd BedsideBlink && bash serve.sh — then open http://localhost:8080 in your browser.");
    return;
  }
  if (speechSynthesis.getVoices().length) pickDefaultVoice();
  speechSynthesis.onvoiceschanged = () => pickDefaultVoice();
  state.caregiverMode = localStorage.getItem(CAREGIVER_MODE_KEY) === "1";
  document.body.classList.toggle("patient-mode", !state.caregiverMode);
  const cgBtn = document.getElementById("caregiver-toggle");
  if (cgBtn) cgBtn.textContent = state.caregiverMode ? "Patient view" : "Caregiver";
  const panelBtn = document.getElementById("caregiver-toggle-panel");
  if (panelBtn) panelBtn.textContent = state.caregiverMode ? "Patient view" : "Caregiver";
  if (state.caregiverMode) openCaregiverPanel();
  updateStatusHint();
  if (!localStorage.getItem(ONBOARDING_SEEN_KEY)) {
    document.getElementById("onboarding-overlay")?.classList.remove("hidden");
  }
  document.getElementById("onboarding-continue")?.addEventListener("click", () => {
    try { localStorage.setItem(ONBOARDING_SEEN_KEY, "1"); } catch (_) {}
    document.getElementById("onboarding-overlay")?.classList.add("hidden");
  });
  document.querySelector(".camera-container")?.insertAdjacentHTML("beforeend", '<p class="init-status" style="position:absolute;bottom:12px;left:0;right:0;text-align:center;color:#94a3b8;font-size:14px;">Loading…</p>');
  try {
    await loadContent();
  } catch (e) {
    showInitError("Config load failed: " + e.message);
    return;
  }
  document.querySelector(".init-status")?.remove();
  checkAuthSession();
  if (supabaseClient?.auth?.onAuthStateChange) {
    supabaseClient.auth.onAuthStateChange(() => checkAuthSession());
  }
  document.getElementById("btn-start").addEventListener("click", () => {
    state.session = [];
    showScreen("home");
    goHome();
  });
  document.getElementById("btn-pause").addEventListener("click", async () => {
    state.paused = !state.paused;
    const btn = document.getElementById("btn-pause");
    const patientPause = document.getElementById("btn-pause-patient");
    const text = state.paused ? "Resume" : "Pause";
    if (btn) { btn.textContent = text; btn.classList.toggle("paused", state.paused); }
    if (patientPause) patientPause.textContent = text;
    const overlay = document.getElementById("pause-overlay");
    if (overlay) overlay.classList.toggle("hidden", !state.paused);
    if (state.paused) {
      stopCamera();
    } else {
      try { await startCamera(); } catch (e) { console.warn("Camera restart failed:", e); }
    }
    updateCameraButton();
  });
  document.getElementById("btn-camera-toggle").addEventListener("click", async () => {
    if (state.paused) {
      await unpauseSession();
      return;
    }
    state.paused = true;
    stopCamera();
    const btn = document.getElementById("btn-pause");
    const patientPause = document.getElementById("btn-pause-patient");
    if (btn) { btn.textContent = "Resume"; btn.classList.add("paused"); }
    if (patientPause) patientPause.textContent = "Resume";
    const overlay = document.getElementById("pause-overlay");
    if (overlay) overlay.classList.remove("hidden");
    updateCameraButton();
  });
  document.getElementById("pause-overlay")?.addEventListener("click", () => {
    if (state.paused) unpauseSession();
  });
  document.getElementById("pause-overlay")?.addEventListener("keydown", (e) => {
    if (state.paused && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); unpauseSession(); }
  });
  function updateMuteButtonLabel() {
    const btn = document.getElementById("btn-mute");
    if (!btn) return;
    btn.textContent = config.auditory_scanning ? "Mute" : "Unmute";
    btn.classList.toggle("muted", !config.auditory_scanning);
  }
  document.getElementById("btn-mute").addEventListener("click", () => {
    config.auditory_scanning = !config.auditory_scanning;
    updateMuteButtonLabel();
    if (config.auditory_scanning) {
      playBeep(600, 100);
      setTimeout(() => speak("Sound on", true), 150);
    }
  });
  document.getElementById("btn-quick-yes-no").addEventListener("click", () => {
    const ret = state.screen === "face_ready" ? "face_ready" : state.screen;
    showQuickYesNo(ret);
  });
  document.getElementById("btn-dismiss-emergency").addEventListener("click", () => {
    document.getElementById("screen-emergency").classList.add("hidden");
    if (state.screen !== "face_ready") goHome();
  });
  function updateSettingsSliderLabels() {
    const scanMs = parseInt(document.getElementById("setting-scan-speed")?.value, 10) || config.scan_speed_ms;
    const blinkMs = parseInt(document.getElementById("setting-blink-ms")?.value, 10) || config.selection_blink_ms;
    const emergencyMs = parseInt(document.getElementById("setting-emergency-ms")?.value, 10) || config.emergency_blink_ms;
    const scanLabel = document.getElementById("setting-scan-speed-label");
    const scanMsEl = document.getElementById("setting-scan-speed-ms");
    if (scanLabel) scanLabel.textContent = getScanSpeedLabel(scanMs);
    if (scanMsEl) scanMsEl.textContent = String(scanMs);
    const blinkLabel = document.getElementById("setting-blink-label");
    const blinkMsVal = document.getElementById("setting-blink-ms-value");
    if (blinkLabel) blinkLabel.textContent = getSelectionBlinkLabel(blinkMs);
    if (blinkMsVal) blinkMsVal.textContent = String(blinkMs);
    const emergencyLabel = document.getElementById("setting-emergency-label");
    const emergencyMsVal = document.getElementById("setting-emergency-ms-value");
    if (emergencyLabel) emergencyLabel.textContent = getEmergencyBlinkLabel(emergencyMs);
    if (emergencyMsVal) emergencyMsVal.textContent = String(emergencyMs);
  }
  document.getElementById("btn-settings-main").addEventListener("click", () => {
    closeSetupDropdown();
    document.getElementById("settings-modal").classList.remove("hidden");
    renderAccountSection();
    document.getElementById("setting-scan-speed").value = config.scan_speed_ms;
    document.getElementById("setting-blink-ms").value = config.selection_blink_ms;
    document.getElementById("setting-emergency-ms").value = config.emergency_blink_ms;
    updateSettingsSliderLabels();
    document.getElementById("setting-auditory").checked = config.auditory_scanning;
    document.getElementById("setting-volume").value = config.volume * 100;
    document.getElementById("setting-voice-engine").value = config.voiceEngine || "browser";
    document.getElementById("setting-responsivevoice-key").value = config.responsiveVoiceKey || "";
    const piperSelect = document.getElementById("setting-piper-voice");
    piperSelect.innerHTML = "<option value=''>— Select Piper voice —</option>" +
      PIPER_VOICES.map(p => `<option value="${p.id}" ${config.piperVoiceId === p.id ? "selected" : ""}>${p.name}</option>`).join("");
    document.getElementById("setting-piper-status").textContent = piperLoadFailed ? " (Piper load failed)" : "";
    document.getElementById("setting-responsivevoice-wrap").classList.toggle("hidden", (config.voiceEngine || "browser") !== "responsivevoice");
    document.getElementById("setting-piper-wrap").classList.toggle("hidden", (config.voiceEngine || "browser") !== "piper");
  });
  function applyVoiceSettingsFromForm() {
    const engineEl = document.getElementById("setting-voice-engine");
    const piperEl = document.getElementById("setting-piper-voice");
    const rvKeyEl = document.getElementById("setting-responsivevoice-key");
    if (engineEl) config.voiceEngine = engineEl.value || "browser";
    if (piperEl) { const v = piperEl.value; config.piperVoiceId = (v && v.trim()) ? v : null; }
    if (rvKeyEl) config.responsiveVoiceKey = (rvKeyEl.value || "").trim();
    saveVoiceConfig();
  }
  document.getElementById("setting-voice-engine").addEventListener("change", () => {
    const engine = document.getElementById("setting-voice-engine").value;
    document.getElementById("setting-responsivevoice-wrap").classList.toggle("hidden", engine !== "responsivevoice");
    document.getElementById("setting-piper-wrap").classList.toggle("hidden", engine !== "piper");
    applyVoiceSettingsFromForm();
  });
  document.getElementById("setting-piper-voice").addEventListener("change", applyVoiceSettingsFromForm);
  document.getElementById("btn-piper-download").addEventListener("click", async () => {
    const sel = document.getElementById("setting-piper-voice");
    const voiceId = sel?.value;
    if (!voiceId) return;
    const statusEl = document.getElementById("setting-piper-status");
    statusEl.textContent = " Downloading…";
    try {
      const mod = await loadPiperTts();
      if (piperLoadFailed || !mod) { statusEl.textContent = " Failed to load Piper."; return; }
      if (typeof mod.download === "function") {
        await mod.download(voiceId, (p) => {
          if (p && typeof p.loaded === "number" && typeof p.total === "number" && p.total > 0) {
            statusEl.textContent = ` ${Math.round((p.loaded / p.total) * 100)}%`;
          }
        });
      }
      statusEl.textContent = " Ready.";
      applyVoiceSettingsFromForm();
    } catch (e) {
      statusEl.textContent = " Error.";
    }
  });
  document.getElementById("btn-test-voice").addEventListener("click", () => {
    applyVoiceSettingsFromForm();
    config.volume = parseInt(document.getElementById("setting-volume").value, 10) / 100;
    playBeep(600, 150);
    setTimeout(() => playBeep(800, 150), 200);
    setTimeout(() => playBeep(1000, 150), 400);
    setTimeout(() => speak("Testing. One. Two. Three.", true), 700);
  });
  ["setting-scan-speed", "setting-blink-ms", "setting-emergency-ms"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateSettingsSliderLabels);
  });
  document.getElementById("btn-settings-close").addEventListener("click", () => {
    config.scan_speed_ms = Math.min(8000, Math.max(2000, parseInt(document.getElementById("setting-scan-speed").value, 10) || config.scan_speed_ms));
    config.selection_blink_ms = Math.min(1500, Math.max(500, parseInt(document.getElementById("setting-blink-ms").value, 10) || config.selection_blink_ms));
    config.emergency_blink_ms = Math.min(8000, Math.max(3000, parseInt(document.getElementById("setting-emergency-ms").value, 10) || config.emergency_blink_ms));
    localStorage.setItem("bedsideblink_calibration", JSON.stringify({
      selection_blink_ms: config.selection_blink_ms,
      scan_speed_ms: config.scan_speed_ms,
      calibrationCompleted: state.calibrationCompleted
    }));
    config.auditory_scanning = document.getElementById("setting-auditory").checked;
    config.volume = parseInt(document.getElementById("setting-volume").value, 10) / 100;
    config.voiceEngine = document.getElementById("setting-voice-engine").value || "browser";
    config.responsiveVoiceKey = (document.getElementById("setting-responsivevoice-key").value || "").trim();
    const pv = document.getElementById("setting-piper-voice").value;
    config.piperVoiceId = (pv && pv.trim()) ? pv : null;
    saveVoiceConfig();
    updateMuteButtonLabel();
    document.getElementById("settings-modal").classList.add("hidden");
    const toast = document.getElementById("global-toast");
    if (toast) {
      toast.textContent = "Settings saved";
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 2500);
    }
  });
  document.getElementById("btn-new-session").addEventListener("click", () => { state.session = []; goHome(); });
  document.getElementById("btn-end-session").addEventListener("click", () => { showScreen("face_ready"); });
  document.getElementById("btn-new-session-patient")?.addEventListener("click", () => { state.session = []; goHome(); });
  document.getElementById("btn-end-session-patient")?.addEventListener("click", () => { showScreen("face_ready"); });
  document.getElementById("btn-calibration-main").addEventListener("click", () => { closeSetupDropdown(); openCalibration(); });
  document.getElementById("btn-customize")?.addEventListener("click", () => { closeSetupDropdown(); openCustomizeModal(); });
  document.getElementById("btn-customize-close")?.addEventListener("click", closeCustomizeModal);
  document.getElementById("btn-customize-save")?.addEventListener("click", saveCustomize);
  document.getElementById("customize-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "customize-modal") closeCustomizeModal();
  });
  document.getElementById("btn-calibration-close").addEventListener("click", () => {
    saveCalibrationState();
    state.calibrationMode = null;
    document.getElementById("calibration-modal").classList.add("hidden");
  });
  document.getElementById("btn-calibration-done")?.addEventListener("click", () => {
    state.calibrationMode = null;
    document.getElementById("calibration-modal").classList.add("hidden");
  });
  document.getElementById("calibration-scan-speed")?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 2000 && val <= 8000) config.scan_speed_ms = val;
    updateCalibrationSliderLabel();
  });
  document.getElementById("calibration-scan-speed")?.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 2000 && val <= 8000) config.scan_speed_ms = val;
    updateCalibrationSliderLabel();
  });
  function closeDailySummaryModal() {
    document.getElementById("daily-summary-modal").classList.add("hidden");
  }
  document.getElementById("btn-sitemap")?.addEventListener("click", openSiteMapModal);
  document.getElementById("btn-sitemap-close")?.addEventListener("click", closeSiteMapModal);
  document.getElementById("sitemap-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "sitemap-modal") closeSiteMapModal();
  });
  document.getElementById("btn-setup-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById("setup-dropdown");
    const expanded = dropdown && !dropdown.classList.contains("hidden");
    if (dropdown) dropdown.classList.toggle("hidden", expanded);
    document.getElementById("btn-setup-toggle")?.setAttribute("aria-expanded", expanded ? "false" : "true");
  });
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("setup-dropdown");
    const toggle = document.getElementById("btn-setup-toggle");
    if (!dropdown || dropdown.classList.contains("hidden")) return;
    if (toggle?.contains(e.target) || dropdown.contains(e.target)) return;
    dropdown.classList.add("hidden");
    toggle?.setAttribute("aria-expanded", "false");
  });
  document.getElementById("setup-dropdown")?.addEventListener("click", (e) => e.stopPropagation());
  function closeSetupDropdown() {
    const dropdown = document.getElementById("setup-dropdown");
    if (dropdown) dropdown.classList.add("hidden");
    document.getElementById("btn-setup-toggle")?.setAttribute("aria-expanded", "false");
  }
  document.getElementById("btn-daily-summary").addEventListener("click", () => {
    renderDailySummary();
    document.getElementById("daily-summary-modal").classList.remove("hidden");
  });
  document.getElementById("btn-daily-summary-landing")?.addEventListener("click", () => {
    renderDailySummary();
    document.getElementById("daily-summary-modal").classList.remove("hidden");
  });
  document.getElementById("btn-daily-summary-home")?.addEventListener("click", () => {
    renderDailySummary();
    document.getElementById("daily-summary-modal").classList.remove("hidden");
  });
  document.getElementById("btn-home")?.addEventListener("click", () => {
    stopScan();
    state.navStack = [];
    showScreen("face_ready");
    renderDailySummaryLanding();
  });
  document.getElementById("btn-home-patient")?.addEventListener("click", () => {
    goHome();
  });
  document.body.addEventListener("click", (e) => {
    if (e.target.closest(".btn-cancel-flow")) {
      e.preventDefault();
      goHome();
    }
  });
  document.getElementById("caregiver-toggle")?.addEventListener("click", toggleCaregiverMode);
  document.getElementById("caregiver-toggle-panel")?.addEventListener("click", () => {
    toggleCaregiverMode();
    closeCaregiverPanel();
  });
  document.getElementById("btn-caregiver-menu")?.addEventListener("click", toggleCaregiverPanel);
  document.getElementById("btn-caregiver-panel-close")?.addEventListener("click", closeCaregiverPanel);
  document.getElementById("btn-pause-patient")?.addEventListener("click", () => {
    document.getElementById("btn-pause")?.click();
  });
  document.getElementById("btn-back-to-starting")?.addEventListener("click", () => {
    goToLanding();
  });
  document.getElementById("btn-daily-summary-close").addEventListener("click", closeDailySummaryModal);
  document.getElementById("daily-summary-modal").addEventListener("click", (e) => {
    if (e.target.id === "daily-summary-modal") closeDailySummaryModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const panel = document.getElementById("caregiver-nav-panel");
    if (panel && panel.classList.contains("panel-open")) {
      closeCaregiverPanel();
      e.preventDefault();
      return;
    }
    if (!document.getElementById("daily-summary-modal").classList.contains("hidden")) closeDailySummaryModal();
    else if (!document.getElementById("sitemap-modal").classList.contains("hidden")) closeSiteMapModal();
  });

  let faceSeconds = 0;
  let totalSeconds = 0;
  const startWaitSeconds = localStorage.getItem("bedsideblink_calibration") ? 3 : 10;
  setInterval(() => {
    if (state.screen === "face_ready") {
      totalSeconds += 0.5;
      if (state.faceDetected) {
        faceSeconds += 0.5;
        if (faceSeconds >= startWaitSeconds) {
          document.getElementById("btn-start").disabled = false;
          faceSeconds = startWaitSeconds;
          updateFaceReadyBlinkHint();
        }
      } else {
        faceSeconds = 0;
        if (totalSeconds >= 3) {
          document.getElementById("btn-start").disabled = false;
          updateFaceReadyBlinkHint();
        }
      }
    } else {
      faceSeconds = 0;
      totalSeconds = 0;
    }
  }, 500);

  document.querySelector(".init-status")?.remove();
  document.querySelector(".camera-container")?.insertAdjacentHTML("beforeend", '<p class="init-status" style="position:absolute;bottom:12px;left:0;right:0;text-align:center;color:#94a3b8;font-size:14px;">Starting camera…</p>');
  try {
    await initFaceLandmarker();
  } catch (e) {
    document.querySelector(".init-status")?.remove();
    showInitError("Face model failed: " + e.message + ". Check your connection.");
    return;
  }
  try {
    await startCamera();
  } catch (e) {
    document.querySelector(".init-status")?.remove();
    const msg = e.name === "NotAllowedError" ? "Camera access denied. Allow camera in your browser." : (e.name === "NotFoundError" ? "No camera found." : e.message);
    showInitError(msg);
    return;
  }
  document.querySelector(".init-status")?.remove();
  updateFaceReadyBlinkHint();
  updateMuteButtonLabel();
  renderDailySummaryLanding();
  processFrame();
  updateCameraButton();

  setInterval(runCountdownUpdate, 150);
}

init();
