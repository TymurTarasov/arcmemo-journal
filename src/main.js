import { supabase } from "./supabase.js";
import { createWalletClient, createPublicClient, custom, http, parseUnits, encodeFunctionData, formatUnits } from "viem";

const ARC_TESTNET = {
  id: 5042002, name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
};
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const ERC20_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];
const ERC20_EXT_ABI = [
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
];

// ─── BATCH SEND (multisend contract — one signature for many recipients) ──
const MULTISEND_ADDRESS = "0x1ae3CCcC01D9124e8455ff973CB45da452b44654";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
const MULTISEND_ABI = [
  { name: "multisend", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ], outputs: [] },
];
async function batchSend(recipients, amounts, onStatus) {
  const pc = createPublicClient({ chain: ARC_TESTNET, transport: http("https://rpc.testnet.arc.network") });
  const wc = createWalletClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
  const total = amounts.reduce((a, b) => a + b, 0n);

  const allowance = await pc.readContract({ address: USDC_ADDRESS, abi: ERC20_EXT_ABI, functionName: "allowance", args: [account, MULTISEND_ADDRESS] });
  if (allowance < total) {
    onStatus("Approving USDC for batch sending (one-time)...");
    const approveData = encodeFunctionData({ abi: ERC20_EXT_ABI, functionName: "approve", args: [MULTISEND_ADDRESS, MAX_UINT256] });
    const approveHash = await wc.sendTransaction({ account, to: USDC_ADDRESS, data: approveData });
    await pc.waitForTransactionReceipt({ hash: approveHash });
  }

  onStatus("Sending " + recipients.length + " payments in one transaction...");
  const data = encodeFunctionData({ abi: MULTISEND_ABI, functionName: "multisend", args: [USDC_ADDRESS, recipients, amounts] });
  const hash = await wc.sendTransaction({ account, to: MULTISEND_ADDRESS, data });
  await pc.waitForTransactionReceipt({ hash });
  return hash;
}

const DEFAULT_COLORS = { Payment:"#009dbd", Gift:"#f59e0b", Work:"#3b82f6", Other:"#6b7280" };
const TYPE_ICONS = {
  note: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  event: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/></svg>',
  holiday: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  custom: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
  payment: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
};
const ICON_PERSON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const ICON_CHEVRON_LEFT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const ICON_CHEVRON_RIGHT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const TYPE_COLORS = { note:"#009dbd", event:"#f97316", holiday:"#ec4899", custom:"#8b5cf6", payment:"#22c55e" };

const $ = id => document.getElementById(id);

let account = null;
let allHistory = [], allContacts = [], allCategories = [], allCalendarEvents = [], allScheduled = [];
let currentCalDate = new Date();
let selectedSchedDay = null;
let multiRecipients = [];
let historyExpanded = false, lastHistoryFull = [];
const HISTORY_PAGE_SIZE = 10;

// ─── THEME ───────────────────────────────────────────────────────────
let isDark = localStorage.getItem("mj_theme") !== "light";
function applyTheme() {
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("light", !isDark);
}
applyTheme();
$("themeToggle").onclick = () => { isDark = !isDark; localStorage.setItem("mj_theme", isDark ? "dark" : "light"); applyTheme(); };

// ─── TOAST ───────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const old = $("toast"); if (old) old.remove();
  const cfg = {
    success: { border:"#22c55e", iconBg:"rgba(34,197,94,0.15)", icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
    error:   { border:"#ef4444", iconBg:"rgba(239,68,68,0.15)", icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
    info:    { border:"#009dbd", iconBg:"var(--accent-soft)", icon:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#009dbd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
  };
  const c = cfg[type] || cfg.info;
  const t = document.createElement("div");
  t.id = "toast";
  t.className = "fixed top-5 right-5 z-[100] max-w-sm toast-in";
  t.innerHTML =
    '<div class="card border rounded-2xl p-4 flex items-start gap-3 shadow-2xl" style="border-color:' + c.border + '55">' +
    '<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:' + c.iconBg + '">' + c.icon + '</div>' +
    '<div class="text-sm font-medium leading-snug pt-1">' + msg + '</div>' +
    '</div>';
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity 0.4s, transform 0.4s"; t.style.opacity = "0"; t.style.transform = "translateX(16px)"; setTimeout(() => t.remove(), 400); }, 5000);
}
function txLink(hash, label) {
  return '<a href="https://testnet.arcscan.app/tx/' + hash + '" target="_blank" class="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-accent hover:underline">' +
    (label || 'View transaction') +
    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>';
}

// ─── CONTACT PICK MODAL ──────────────────────────────────────────────
function createContactModal() {
  if ($("contactPickModal")) return;
  const m = document.createElement("div");
  m.id = "contactPickModal";
  m.className = "hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]";
  m.innerHTML = `<div class="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold">Choose a contact</h3>
      <button id="closeContactPickModal" class="text-zinc-500 hover:text-white text-lg">✕</button>
    </div>
    <input id="contactSearchModal" type="text" placeholder="Search..."
      class="w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl px-4 py-2.5 text-sm outline-none mb-3 placeholder:text-zinc-600">
    <div id="contactModalList" class="space-y-2 max-h-64 overflow-y-auto"></div>
  </div>`;
  document.body.appendChild(m);
  $("closeContactPickModal").onclick = () => m.classList.add("hidden");
  m.onclick = e => { if (e.target === m) m.classList.add("hidden"); };
  $("contactSearchModal").addEventListener("input", e => renderContactModalList(e.target.value));
}

let contactPickCallback = null;
function openContactPicker(cb) {
  contactPickCallback = cb;
  $("contactSearchModal").value = "";
  renderContactModalList("");
  $("contactPickModal").classList.remove("hidden");
}
function renderContactModalList(q = "") {
  const list = $("contactModalList");
  const f = allContacts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.address.toLowerCase().includes(q.toLowerCase()));
  if (!f.length) { list.innerHTML = '<p class="text-zinc-600 text-xs text-center py-4">No contacts found</p>'; return; }
  list.innerHTML = f.map(c =>
    '<div onclick="pickContactItem(\'' + c.address + '\',\'' + c.name + '\')" class="flex items-center gap-3 p-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-2xl cursor-pointer transition border border-transparent hover:border-zinc-600">' +
    '<div class="w-9 h-9 rounded-full avatar-accent flex items-center justify-center font-semibold text-xs shrink-0">' + c.name.slice(0,2).toUpperCase() + '</div>' +
    '<div class="flex-1 min-w-0"><div class="text-sm font-medium text-white">' + c.name + '</div>' +
    '<div class="font-mono text-xs text-zinc-500 truncate">' + c.address + '</div></div>' +
    '<span class="text-accent text-xs">→</span></div>'
  ).join("");
}
window.pickContactItem = (address, name) => {
  $("contactPickModal").classList.add("hidden");
  if (contactPickCallback) { contactPickCallback(address, name); contactPickCallback = null; }
};

// ─── MULTI-SEND ──────────────────────────────────────────────────────
$("switchToMultiBtn").onclick = () => {
  document.querySelector(".card").classList.add("hidden");
  $("multiSendCard").classList.remove("hidden");
  syncMultiCategorySelect();
  if (multiRecipients.length === 0) addRecipientRow();
  updateMultiSummary();
};
$("switchToSingleBtn").onclick = () => {
  $("multiSendCard").classList.add("hidden");
  document.querySelector(".card").classList.remove("hidden");
};

function buildCategoryOptions() {
  return [
    { name:"Payment", color:DEFAULT_COLORS.Payment },
    { name:"Gift", color:DEFAULT_COLORS.Gift },
    { name:"Work", color:DEFAULT_COLORS.Work },
    { name:"Other", color:DEFAULT_COLORS.Other },
    ...allCategories.map(c => ({ name:c.name, color:c.color||"#6b7280" }))
  ];
}
function renderCategoryDropdown(prefix, options) {
  $(prefix + "Dropdown").innerHTML = options.map(o =>
    '<div onclick="selectCategoryOption(\''+prefix+'\',\''+o.name.replace(/'/g,"\\'")+'\')" class="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer row-hover text-sm">' +
    '<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:'+o.color+'"></span>' + o.name +
    '</div>'
  ).join("");
}
function setCategoryDisplay(prefix, name, color) {
  $(prefix + "DisplayDot").style.background = color;
  $(prefix + "DisplayLabel").textContent = name;
}
window.selectCategoryOption = (prefix, name) => {
  const opt = buildCategoryOptions().find(o => o.name === name) || { name, color:"#6b7280" };
  $(prefix).value = opt.name;
  $(prefix).dispatchEvent(new Event("change"));
  setCategoryDisplay(prefix, opt.name, opt.color);
  $(prefix + "Dropdown").classList.add("hidden");
};
function syncMultiCategorySelect() {
  const opts = buildCategoryOptions();
  const cur = $("multiCategory").value || $("category").value || opts[0].name;
  renderCategoryDropdown("multiCategory", opts);
  const curOpt = opts.find(o => o.name === cur) || opts[0];
  $("multiCategory").value = curOpt.name;
  setCategoryDisplay("multiCategory", curOpt.name, curOpt.color);
}
$("categoryDisplay").onclick = (e) => { e.stopPropagation(); $("categoryDropdown").classList.toggle("hidden"); $("multiCategoryDropdown").classList.add("hidden"); };
$("multiCategoryDisplay").onclick = (e) => { e.stopPropagation(); $("multiCategoryDropdown").classList.toggle("hidden"); $("categoryDropdown").classList.add("hidden"); };
document.addEventListener("click", () => { $("categoryDropdown").classList.add("hidden"); $("multiCategoryDropdown").classList.add("hidden"); });

function addRecipientRow(address = "", name = "") {
  const id = Date.now() + Math.random();
  multiRecipients.push({ id, address, name });
  renderMultiRecipients();
}

function renderMultiRecipients() {
  const el = $("multiRecipientList");
  if (!multiRecipients.length) {
    el.innerHTML = '<p class="text-xs t3 text-center py-2">No recipients yet — add contacts or addresses</p>';
    updateMultiSummary();
    return;
  }
  el.innerHTML = multiRecipients.map((r, i) =>
    '<div class="flex items-center gap-2 p-2.5 rounded-xl border bdr" style="background:var(--card)">' +
    '<div class="w-7 h-7 rounded-full avatar-accent flex items-center justify-center font-semibold text-xs shrink-0">' +
    (r.name ? r.name.slice(0,2).toUpperCase() : (i+1)) + '</div>' +
    '<div class="flex-1 min-w-0">' +
    (r.name ? '<div class="text-xs font-medium">' + r.name + '</div>' : '') +
    '<input data-idx="' + i + '" type="text" value="' + r.address + '" placeholder="0x..." ' +
    'class="inp w-full border-0 border-b rounded-none px-0 py-0.5 text-xs font-mono bg-transparent outline-none" ' +
    'oninput="updateMultiAddress(' + i + ',this.value)">' +
    '</div>' +
    '<button onclick="removeMultiRecipient(' + i + ')" class="text-zinc-600 hover:text-red-400 transition text-xs shrink-0 px-1">✕</button>' +
    '</div>'
  ).join("");
  updateMultiSummary();
}

function updateMultiSummary() {
  const count = multiRecipients.filter(r => r.address).length;
  const amount = parseFloat($("multiAmount").value) || 0;
  const total = count * amount;
  $("multiSummary").classList.toggle("hidden", count === 0);
  $("multiCount").textContent = count;
  $("multiTotal").textContent = total.toFixed(2) + " USDC";
}

window.updateMultiAddress = (i, val) => { if (multiRecipients[i]) { multiRecipients[i].address = val; updateMultiSummary(); } };
window.removeMultiRecipient = i => { multiRecipients.splice(i, 1); renderMultiRecipients(); };

$("addRecipientRowBtn").onclick = () => addRecipientRow();

$("addFromContactsBtn").onclick = () => {
  if (!allContacts.length) { showToast("No contacts yet", "info"); return; }
  const m = $("contactPickModal");
  const list = $("contactModalList");
  $("contactSearchModal").value = "";
  const f = allContacts;
  list.innerHTML = f.map(c =>
    '<div onclick="addContactToMulti(\'' + c.address + '\',\'' + c.name + '\')" class="flex items-center gap-3 p-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-2xl cursor-pointer transition border border-transparent hover:border-[var(--accent)]">' +
    '<div class="w-9 h-9 rounded-full avatar-accent flex items-center justify-center font-semibold text-xs shrink-0">' + c.name.slice(0,2).toUpperCase() + '</div>' +
    '<div class="flex-1 min-w-0"><div class="text-sm font-medium text-white">' + c.name + '</div>' +
    '<div class="font-mono text-xs text-zinc-500 truncate">' + c.address + '</div></div>' +
    '<span class="text-accent text-xs">+ Add</span></div>'
  ).join("");
  contactPickCallback = null;
  m.classList.remove("hidden");
};

window.addContactToMulti = (address, name) => {
  if (multiRecipients.find(r => r.address.toLowerCase() === address.toLowerCase())) {
    showToast(name + " already added", "info"); return;
  }
  addRecipientRow(address, name);
  showToast("Added: " + name, "success");
};

$("multiAmount").addEventListener("input", updateMultiSummary);

$("multiSendBtn").onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const recipients = multiRecipients.filter(r => r.address && r.address.startsWith("0x"));
  if (!recipients.length) { showToast("Add at least one recipient", "error"); return; }
  const amount = $("multiAmount").value;
  const memo = $("multiMemo").value.trim();
  const category = $("multiCategory").value;
  if (!amount || parseFloat(amount) <= 0) { showToast("Enter a valid amount", "error"); return; }

  $("multiSendBtnLabel").textContent = "Sending..."; $("multiSendBtn").disabled = true;
  $("multiProgress").classList.remove("hidden");
  $("multiProgress").innerHTML = '<div class="text-xs t3 text-center py-2" id="batchStatus">Preparing batch...</div>';

  try {
    const amountWei = parseUnits(amount, 6);
    const hash = await batchSend(
      recipients.map(r => r.address),
      recipients.map(() => amountWei),
      (status) => { const el = $("batchStatus"); if (el) el.textContent = status; }
    );
    await Promise.all(recipients.map(r =>
      supabase.from("transactions").insert({ wallet: account.toLowerCase(), recipient: r.address, amount: parseFloat(amount), memo, category, txhash: hash })
    ));
    await Promise.all([loadHistory(), loadBalance()]);
    showToast('<div>Sent to <b>' + recipients.length + ' recipients</b> in a single transaction</div>' + txLink(hash), "success");
    $("multiProgress").classList.add("hidden");
  } catch (err) {
    showToast("Batch send error: " + err.message, "error");
    $("multiProgress").classList.add("hidden");
  } finally {
    $("multiSendBtnLabel").textContent = "Send to All →"; $("multiSendBtn").disabled = false;
  }
};

// ─── CATEGORIES ──────────────────────────────────────────────────────
function getCategoryColor(name) {
  if (DEFAULT_COLORS[name]) return DEFAULT_COLORS[name];
  const c = allCategories.find(c => c.name === name);
  return c ? (c.color || "#6b7280") : "#6b7280";
}
function updateCategorySelect() {
  const opts = buildCategoryOptions();
  const cur = $("category").value || opts[0].name;
  renderCategoryDropdown("category", opts);
  const curOpt = opts.find(o => o.name === cur) || opts[0];
  $("category").value = curOpt.name;
  setCategoryDisplay("category", curOpt.name, curOpt.color);
  syncMultiCategorySelect();
}

async function loadCategories() {
  if (!account) return;
  const { data } = await supabase.from("categories").select("*").eq("wallet", account.toLowerCase()).order("created_at", { ascending:true });
  allCategories = data || [];
  updateCategorySelect();
  renderSavedCategories();
  $("savedCategoriesBar").classList.remove("hidden");
}
function renderSavedCategories() {
  const el = $("savedCategoriesList");
  if (!allCategories.length) { el.innerHTML = '<span class="text-xs t3">No custom categories yet</span>'; return; }
  el.innerHTML = allCategories.map(c =>
    '<div class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border group" style="background:' + (c.color||"#009dbd") + '22;border-color:' + (c.color||"#009dbd") + '55">' +
    '<span class="w-2 h-2 rounded-full shrink-0" style="background:' + (c.color||"#009dbd") + '"></span>' +
    '<button onclick="selectCategory(\'' + c.name + '\')" class="text-xs font-medium transition" style="color:' + (c.color||"#009dbd") + '">' + c.name + '</button>' +
    '<button onclick="renameCategory(' + c.id + ',\'' + c.name + '\')" class="text-zinc-600 hover:text-accent text-xs ml-1 transition">✎</button>' +
    '<button onclick="deleteCategoryById(' + c.id + ')" class="text-zinc-600 hover:text-red-400 text-xs transition">✕</button>' +
    '</div>'
  ).join("");
}
window.selectCategory = name => { window.selectCategoryOption("category", name); showToast("Category: " + name, "info"); };
window.renameCategory = async (id, oldName) => {
  const n = prompt('Rename "' + oldName + '" to:', oldName);
  if (!n || n.trim() === oldName) return;
  await supabase.from("categories").update({ name: n.trim() }).eq("id", id);
  await loadCategories(); showToast("Renamed ✓", "success");
};
window.deleteCategoryById = async id => {
  if (!confirm("Delete this category?")) return;
  await supabase.from("categories").delete().eq("id", id);
  await loadCategories(); showToast("Deleted", "info");
};
$("addCategoryBtn").onclick = async () => {
  const name = $("newCategoryInput").value.trim(), color = $("newCategoryColor").value;
  if (!name) { showToast("Enter a name", "error"); return; }
  if (!account) { showToast("Connect wallet first", "error"); return; }
  if (allCategories.find(c => c.name.toLowerCase() === name.toLowerCase())) { showToast("Already exists", "info"); return; }
  const { error } = await supabase.from("categories").insert({ wallet: account.toLowerCase(), name, color });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  $("newCategoryInput").value = "";
  await loadCategories(); showToast("Category saved: " + name, "success");
};
$("newCategoryInput").addEventListener("keydown", e => { if (e.key === "Enter") $("addCategoryBtn").click(); });

// ─── AUTO-CONNECT ─────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  createContactModal();
  updateCategorySelect();
  renderSchedCalendar();
  initPageNav();
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      account = accounts[0]; updateWalletUI(); await switchToArc();
      await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories(), loadScheduled(), loadCalendarEvents(), updateSwapBalances(), loadSwapHistory()]);
    }
  } catch (e) { console.log("Auto-connect:", e); }
});

// ─── CONNECT / DISCONNECT ─────────────────────────────────────────────
$("connectBtn").onclick = async () => {
  if (!window.ethereum) { showToast("Please install MetaMask", "error"); return; }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0]; updateWalletUI(); await switchToArc();
    await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories(), loadScheduled(), loadCalendarEvents(), updateSwapBalances(), loadSwapHistory()]);
  } catch (err) { showToast("Error: " + err.message, "error"); }
};
function updateWalletUI() {
  $("walletStatus").innerHTML = '<span class="text-accent font-mono text-xs">' + account.slice(0,6) + "..." + account.slice(-4) + "</span>";
  $("networkBadge").classList.remove("hidden");
  $("balanceDisplay").classList.remove("hidden");
  const btn = $("connectBtn");
  btn.textContent = "Disconnect";
  btn.className = "px-4 py-2.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 text-sm font-medium rounded-2xl transition border border-zinc-700 whitespace-nowrap";
  btn.onclick = disconnectWallet;
}
function disconnectWallet() {
  account = null; allHistory = []; allContacts = []; allCategories = []; allCalendarEvents = [];
  $("walletStatus").innerHTML = ""; $("balanceDisplay").textContent = ""; $("balanceDisplay").classList.add("hidden");
  $("networkBadge").classList.add("hidden"); $("savedCategoriesBar").classList.add("hidden");
  const btn = $("connectBtn");
  btn.textContent = "Connect Wallet";
  btn.className = "px-4 py-2.5 bg-white text-black text-sm font-medium rounded-2xl hover:bg-zinc-100 transition whitespace-nowrap";
  btn.onclick = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accounts[0]; updateWalletUI(); await switchToArc();
      await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories(), loadScheduled(), loadCalendarEvents(), updateSwapBalances(), loadSwapHistory()]);
    } catch (err) { showToast("Error: " + err.message, "error"); }
  };
  historyExpanded = false; swapHistoryExpanded = false;
  renderHistory([]); renderContacts([]); renderSwapHistory([]);
  $("scheduledList").innerHTML = '<div class="text-center py-6 t3 text-xs">No scheduled payments</div>';
  updateSwapBalances();
  showToast("Wallet disconnected", "info");
}
async function loadBalance() {
  if (!account) return;
  try {
    const pub = createPublicClient({ chain: ARC_TESTNET, transport: http("https://rpc.testnet.arc.network") });
    const raw = await pub.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [account] });
    $("balanceDisplay").textContent = parseFloat(formatUnits(raw, 6)).toFixed(2) + " USDC";
  } catch (e) { console.error("Balance:", e); }
}
async function switchToArc() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x4CEF52" }] });
  } catch (e) {
    if (e.code === 4902) await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
      chainId: "0x4CEF52", chainName: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"],
    }]});
  }
}

// ─── SINGLE SEND ─────────────────────────────────────────────────────
$("sendBtn").onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const to = $("recipient").value.trim(), amount = $("amount").value, memo = $("memo").value.trim(), category = $("category").value;
  if (!to || !amount) { showToast("Fill in recipient and amount", "error"); return; }
  try {
    $("sendBtn").textContent = "⏳ Sending..."; $("sendBtn").disabled = true;
    const wc = createWalletClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to, parseUnits(amount, 6)] });
    const hash = await wc.sendTransaction({ account, to: USDC_ADDRESS, data });
    await supabase.from("transactions").insert({ wallet: account.toLowerCase(), recipient: to, amount: parseFloat(amount), memo, category, txhash: hash });
    await Promise.all([loadHistory(), loadBalance()]);
    showToast('<div>Sent <b>' + amount + ' USDC</b></div>' + txLink(hash), "success");
    $("recipient").value = ""; $("memo").value = ""; $("amount").value = "1";
  } catch (err) { showToast("Error: " + err.message, "error"); }
  finally { $("sendBtn").textContent = "Send with Memo →"; $("sendBtn").disabled = false; }
};

// ─── HISTORY ─────────────────────────────────────────────────────────
async function loadHistory() {
  if (!account) return;
  const { data } = await supabase.from("transactions").select("*").eq("wallet", account.toLowerCase()).order("created_at", { ascending: false });
  allHistory = data || []; renderHistory(allHistory);
}
function getContactName(addr) {
  const c = allContacts.find(c => c.address.toLowerCase() === addr.toLowerCase());
  return c ? c.name : null;
}
function renderHistory(items) {
  lastHistoryFull = items;
  const el = $("historyList"), toggleWrap = $("historyToggleWrap");
  if (!items.length) {
    el.innerHTML = '<div class="text-center py-8 t3 text-sm">No transactions yet</div>';
    if (toggleWrap) toggleWrap.innerHTML = "";
    return;
  }
  const shown = historyExpanded ? items : items.slice(0, HISTORY_PAGE_SIZE);
  el.innerHTML = shown.map(tx => {
    const name = getContactName(tx.recipient), color = getCategoryColor(tx.category);
    const short = tx.recipient.slice(0,6) + "..." + tx.recipient.slice(-4);
    const date = new Date(tx.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" });
    return (
      '<div class="flex items-center gap-2 px-3 py-2 rounded-xl border bdr transition text-xs" style="background:var(--card)">' +
      '<div class="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs shrink-0" style="background:' + color + '22;color:' + color + '">' +
      (name ? name.slice(0,2).toUpperCase() : tx.recipient.slice(2,4).toUpperCase()) + '</div>' +
      '<div class="flex-1 min-w-0 truncate"><span class="font-medium">' + (name || short) + '</span>' +
      (tx.memo ? '<span class="t3"> · ' + tx.memo + '</span>' : '') + '</div>' +
      '<span class="px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0" style="background:' + color + '22;color:' + color + '">' + tx.category + '</span>' +
      '<span class="text-accent font-semibold shrink-0">' + tx.amount + ' USDC</span>' +
      '<span class="t3 shrink-0">' + date + '</span>' +
      (tx.txhash ? '<a href="https://testnet.arcscan.app/tx/' + tx.txhash + '" target="_blank" class="t3 hover:text-accent transition shrink-0">↗</a>' : '') +
      '</div>'
    );
  }).join("");
  if (toggleWrap) {
    if (items.length > HISTORY_PAGE_SIZE) {
      toggleWrap.innerHTML = '<button onclick="toggleHistoryExpand()" class="w-full text-xs t3 hover:text-white transition py-2 text-center">' +
        (historyExpanded ? "▲ Show less" : "▼ Show " + (items.length - HISTORY_PAGE_SIZE) + " more") + '</button>';
    } else {
      toggleWrap.innerHTML = "";
    }
  }
}
window.toggleHistoryExpand = () => { historyExpanded = !historyExpanded; renderHistory(lastHistoryFull); };
$("searchInput").addEventListener("input", () => {
  historyExpanded = false;
  const q = $("searchInput").value.toLowerCase();
  renderHistory(allHistory.filter(tx =>
    tx.recipient.toLowerCase().includes(q) || (tx.memo&&tx.memo.toLowerCase().includes(q)) ||
    tx.category.toLowerCase().includes(q) || (getContactName(tx.recipient)||"").toLowerCase().includes(q)
  ));
});
$("exportBtn").onclick = () => {
  if (!allHistory.length) { showToast("No transactions to export", "info"); return; }
  const rows = [["Date","Contact","Recipient","Amount","Memo","Category","TxHash"],
    ...allHistory.map(tx => [new Date(tx.created_at).toLocaleString("en"), getContactName(tx.recipient)||"", tx.recipient, tx.amount, tx.memo||"", tx.category, tx.txhash||""])];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")], { type:"text/csv" }));
  a.download = "memojournal.csv"; a.click(); showToast("CSV downloaded ✓", "success");
};
$("clearHistoryBtn").onclick = async () => {
  if (!account || !confirm("Delete all history?")) return;
  await supabase.from("transactions").delete().eq("wallet", account.toLowerCase());
  allHistory = []; renderHistory([]); showToast("History cleared", "info");
};

// ─── CONTACTS ────────────────────────────────────────────────────────
$("addContactBtn").onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const name = $("contactName").value.trim(), address = $("contactAddress").value.trim();
  if (!name || !address) { showToast("Fill in name and address", "error"); return; }
  const { error } = await supabase.from("contacts").insert({ wallet: account.toLowerCase(), name, address });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  $("contactName").value = ""; $("contactAddress").value = "";
  await loadContacts(); showToast("Contact added ✓", "success");
};
async function loadContacts() {
  if (!account) return;
  const { data } = await supabase.from("contacts").select("*").eq("wallet", account.toLowerCase()).order("created_at", { ascending:true });
  allContacts = data || []; renderContacts(allContacts); renderHistory(allHistory);
}
function renderContacts(contacts) {
  const el = $("contactsList");
  if (!contacts.length) { el.innerHTML = '<p class="t3 text-xs py-1">No contacts yet</p>'; return; }
  el.innerHTML = contacts.map(c =>
    '<div class="flex items-center justify-between py-1.5 px-1 group">' +
    '<div class="flex items-center gap-2">' +
    '<div class="w-7 h-7 rounded-full avatar-accent flex items-center justify-center font-semibold text-xs">' + c.name.slice(0,2).toUpperCase() + '</div>' +
    '<div><div class="text-sm font-medium">' + c.name + '</div>' +
    '<div class="font-mono text-xs t3">' + c.address.slice(0,6) + "..." + c.address.slice(-4) + '</div></div></div>' +
    '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">' +
    '<button onclick="useContact(\'' + c.address + '\',\'' + c.name + '\')" class="text-xs px-2 py-1 bg-accent-soft hover:bg-accent hover:text-white text-accent rounded-lg transition">Send</button>' +
    '<button onclick="editContact(' + c.id + ',\'' + c.name.replace(/'/g,"\\'") + '\',\'' + c.address + '\')" class="text-xs px-2 py-1 t3 hover-accent rounded-lg transition">✎</button>' +
    '<button onclick="deleteContact(' + c.id + ')" class="text-xs px-2 py-1 t3 hover:text-red-400 rounded-lg transition">✕</button>' +
    '</div></div>'
  ).join("");
}
window.useContact = (address, name) => { $("recipient").value = address; showToast("Selected: " + name, "info"); window.scrollTo({ top:0, behavior:"smooth" }); };
window.deleteContact = async id => { await supabase.from("contacts").delete().eq("id", id); await loadContacts(); showToast("Deleted", "info"); };
window.editContact = async (id, oldName, oldAddress) => {
  const newName = prompt("Contact name:", oldName);
  if (newName === null) return;
  const newAddress = prompt("Contact address:", oldAddress);
  if (newAddress === null) return;
  if (!newName.trim() || !newAddress.trim()) { showToast("Name and address can't be empty", "error"); return; }
  const { error } = await supabase.from("contacts").update({ name: newName.trim(), address: newAddress.trim() }).eq("id", id);
  if (error) { showToast("Error: " + error.message, "error"); return; }
  await loadContacts(); showToast("Contact updated ✓", "success");
};
$("chooseContactBtn").onclick = () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  if (!allContacts.length) { showToast("No contacts yet", "info"); return; }
  openContactPicker((address, name) => { $("recipient").value = address; showToast("Selected: " + name, "info"); });
};

// ─── SCHEDULED ───────────────────────────────────────────────────────
function setDefaultDateTime() {
  const d = new Date(Date.now()+3600000), pad = n => String(n).padStart(2,"0");
  $("schedDateTime").value = d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
}
$("toggleScheduleForm").onclick = () => { $("scheduleForm").classList.toggle("hidden"); if (!$("scheduleForm").classList.contains("hidden")) setDefaultDateTime(); };
$("sendAllScheduledBtn").onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const dueItems = allScheduled.filter(p => new Date(p.scheduled_at) <= new Date());
  if (dueItems.length < 2) { showToast("Not enough due payments to batch", "info"); return; }

  const btn = $("sendAllScheduledBtn");
  btn.disabled = true; const originalLabel = btn.textContent; btn.textContent = "Sending...";
  try {
    const amounts = dueItems.map(p => parseUnits(String(p.amount), 6));
    const hash = await batchSend(
      dueItems.map(p => p.recipient),
      amounts,
      (status) => { btn.textContent = status; }
    );
    for (const p of dueItems) {
      await supabase.from("transactions").insert({ wallet: account.toLowerCase(), recipient: p.recipient, amount: parseFloat(p.amount), memo: p.memo, category: p.category, txhash: hash });
      if (p.repeat_type === "once") {
        await supabase.from("scheduled_payments").update({ status: "done" }).eq("id", p.id);
      } else {
        const next = new Date();
        if (p.repeat_type === "daily") next.setDate(next.getDate() + 1);
        if (p.repeat_type === "weekly") next.setDate(next.getDate() + 7);
        if (p.repeat_type === "monthly") next.setMonth(next.getMonth() + 1);
        await supabase.from("scheduled_payments").update({ scheduled_at: next.toISOString() }).eq("id", p.id);
      }
    }
    await Promise.all([loadHistory(), loadBalance(), loadScheduled()]);
    showToast('<div>Sent <b>' + dueItems.length + ' scheduled payments</b> in a single transaction</div>' + txLink(hash), "success");
  } catch (err) {
    showToast("Batch send error: " + err.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = originalLabel;
  }
};
$("cancelScheduleBtn").onclick = () => $("scheduleForm").classList.add("hidden");
$("saveScheduleBtn").onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const r=$("schedRecipient").value.trim(), a=$("schedAmount").value, dt=$("schedDateTime").value, rep=$("schedRepeat").value, m=$("schedMemo").value.trim();
  if (!r||!a||!dt) { showToast("Fill in all fields", "error"); return; }
  const{error}=await supabase.from("scheduled_payments").insert({wallet:account.toLowerCase(),recipient:r,amount:parseFloat(a),memo:m,category:"Payment",scheduled_at:new Date(dt).toISOString(),repeat_type:rep,status:"pending"});
  if(error){showToast("Error: "+error.message,"error");return;}
  $("scheduleForm").classList.add("hidden"); $("schedRecipient").value=""; $("schedMemo").value=""; $("schedAmount").value="1";
  await loadScheduled(); showToast("Scheduled ✓","success");
};
async function loadScheduled() {
  if(!account)return;
  const{data}=await supabase.from("scheduled_payments").select("*").eq("wallet",account.toLowerCase()).eq("status","pending").order("scheduled_at",{ascending:true});
  allScheduled=data||[]; renderScheduled(allScheduled); allScheduled.forEach(p=>scheduleNotification(p));
  checkDueReminder();
}
let lastReminderTime = 0;
function checkDueReminder() {
  const now = new Date();
  const dueItems = allScheduled.filter(p => new Date(p.scheduled_at) <= now);
  const sendAllBtn = $("sendAllScheduledBtn");
  if (sendAllBtn) sendAllBtn.classList.toggle("hidden", dueItems.length < 2);
  if (!dueItems.length) return;
  if (Date.now() - lastReminderTime < 3600000) return;
  lastReminderTime = Date.now();
  const bellIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  const t = document.createElement("div");
  t.id = "bellReminder";
  const old = document.getElementById("bellReminder"); if (old) old.remove();
  t.className = "fixed top-5 right-5 z-[100] max-w-sm toast-in";
  t.innerHTML = '<div class="card border rounded-2xl p-4 flex items-start gap-3 shadow-2xl" style="border-color:#f59e0b55">' +
    '<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(245,158,11,0.15)">' + bellIcon + '</div>' +
    '<div class="text-sm font-medium leading-snug pt-1">You have <b>' + dueItems.length + '</b> scheduled payment' + (dueItems.length > 1 ? "s" : "") + ' waiting to be sent</div>' +
    '</div>';
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity 0.4s, transform 0.4s"; t.style.opacity = "0"; t.style.transform = "translateX(16px)"; setTimeout(() => t.remove(), 400); }, 4000);
}
function renderScheduled(items) {
  const el=$("scheduledList");
  if(!items.length){el.innerHTML='<div class="text-center py-6 t3 text-xs">No scheduled payments</div>';return;}
  const labels={once:"Once",daily:"Daily",weekly:"Weekly",monthly:"Monthly"};
  el.innerHTML=items.map(p=>{
    const dt=new Date(p.scheduled_at),isDue=dt<=new Date(),name=getContactName(p.recipient);
    return '<div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs '+(isDue?'border-amber-500/40 bg-amber-500/5':'bdr')+'">' +
    '<div class="shrink-0" style="color:'+(isDue?'var(--accent)':'var(--text3)')+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg></div>' +
    '<div class="flex-1 min-w-0 truncate"><span class="font-medium">'+(name||p.recipient.slice(0,8)+"...")+' </span>' +
    '<span class="t3">'+dt.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+dt.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})+'</span>' +
    (p.memo?'<span class="t3"> · '+p.memo+'</span>':'')+'</div>' +
    '<span class="text-amber-600 font-semibold shrink-0">'+p.amount+' USDC</span>' +
    '<span class="t3 shrink-0">'+labels[p.repeat_type]+'</span>' +
    (isDue?'<button onclick="executeScheduled('+p.id+',\''+p.recipient+'\','+p.amount+',\''+(p.memo||"")+'\',\'Payment\',\''+p.repeat_type+'\')" class="text-xs px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg transition shrink-0">Send</button>':'')+
    '<button onclick="deleteScheduled('+p.id+')" class="t3 hover:text-red-400 text-xs shrink-0 transition ml-1">✕</button></div>';
  }).join("");
}
window.executeScheduled=async(id,recipient,amount,memo,category,repeatType)=>{
  if(!account){showToast("Connect wallet first!","error");return;}
  showToast("Opening MetaMask...","info");
  try{
    const wc=createWalletClient({chain:ARC_TESTNET,transport:custom(window.ethereum)});
    const data=encodeFunctionData({abi:ERC20_ABI,functionName:"transfer",args:[recipient,parseUnits(String(amount),6)]});
    const hash=await wc.sendTransaction({account,to:USDC_ADDRESS,data});
    await supabase.from("transactions").insert({wallet:account.toLowerCase(),recipient,amount:parseFloat(amount),memo,category,txhash:hash});
    if(repeatType==="once"){await supabase.from("scheduled_payments").update({status:"done"}).eq("id",id);}
    else{const next=new Date();if(repeatType==="daily")next.setDate(next.getDate()+1);if(repeatType==="weekly")next.setDate(next.getDate()+7);if(repeatType==="monthly")next.setMonth(next.getMonth()+1);await supabase.from("scheduled_payments").update({scheduled_at:next.toISOString()}).eq("id",id);}
    await Promise.all([loadHistory(),loadBalance(),loadScheduled()]);
    showToast('<div>Sent <b>'+amount+' USDC</b></div>'+txLink(hash),"success");
  }catch(err){showToast("Error: "+err.message,"error");}
};
window.deleteScheduled=async id=>{if(!confirm("Cancel?"))return;await supabase.from("scheduled_payments").update({status:"cancelled"}).eq("id",id);await loadScheduled();showToast("Cancelled","info");};
function scheduleNotification(p){const ms=new Date(p.scheduled_at)-new Date();if(ms>0&&ms<3600000)setTimeout(()=>{showToast('Payment due: '+p.amount+' USDC',"info");loadScheduled();},ms);}
setInterval(()=>{if(account)loadScheduled();},60000);

// ─── CALENDAR EVENTS ─────────────────────────────────────────────────
async function loadCalendarEvents(){
  if(!account)return;
  const{data}=await supabase.from("calendar_events").select("*").eq("wallet",account.toLowerCase());
  allCalendarEvents=data||[]; renderSchedCalendar();
}
function getDateKey(y,m,d){const pad=n=>String(n).padStart(2,"0");return y+"-"+pad(m+1)+"-"+pad(d);}

// ─── SCHEDULE PAGE CALENDAR (big, permanent — not a popup) ────────────
$("schedPrevMonth").onclick=()=>{currentCalDate.setMonth(currentCalDate.getMonth()-1);renderSchedCalendar();};
$("schedNextMonth").onclick=()=>{currentCalDate.setMonth(currentCalDate.getMonth()+1);renderSchedCalendar();};
$("schedEventType").addEventListener("change",()=>{const t=$("schedEventType").value;$("schedPaymentFields").classList.toggle("hidden",t!=="payment");$("schedCustomFields").classList.toggle("hidden",t!=="custom");$("schedEventColor").value=TYPE_COLORS[t]||"#009dbd";});
document.querySelectorAll("#schedTypeTabs .type-tab").forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll("#schedTypeTabs .type-tab").forEach(t=>t.classList.remove("type-tab-active"));
    tab.classList.add("type-tab-active");
    $("schedEventType").value=tab.dataset.type;
    $("schedEventType").dispatchEvent(new Event("change"));
  };
});
$("schedPickContactBtn").onclick=()=>{if(!allContacts.length){showToast("No contacts yet","info");return;}openContactPicker((address,name)=>{$("schedPayRecipient").value=address;showToast("Selected: "+name,"info");});};
$("schedSaveEventBtn").onclick=async()=>{
  if(!account){showToast("Connect wallet first!","error");return;}
  if(!selectedSchedDay){showToast("Select a day first","error");return;}
  const type=$("schedEventType").value,color=$("schedEventColor").value;
  if(type==="payment"){
    const r=$("schedPayRecipient").value.trim(),a=$("schedPayAmount").value,memo=$("schedEventTitle").value.trim()||"Scheduled transfer";
    if(!r||!a){showToast("Fill recipient and amount","error");return;}
    const pad=n=>String(n).padStart(2,"0");
    const dt=selectedSchedDay.y+"-"+pad(selectedSchedDay.m+1)+"-"+pad(selectedSchedDay.d)+"T09:00";
    await supabase.from("scheduled_payments").insert({wallet:account.toLowerCase(),recipient:r,amount:parseFloat(a),memo,category:"Payment",scheduled_at:new Date(dt).toISOString(),repeat_type:"once",status:"pending"});
    await loadScheduled();showToast("Transfer scheduled ✓","success");
  }else{
    const title=type==="custom"?$("schedCustomLabel").value.trim():$("schedEventTitle").value.trim();
    if(!title){showToast("Enter a title","error");return;}
    const dateKey=getDateKey(selectedSchedDay.y,selectedSchedDay.m,selectedSchedDay.d);
    await supabase.from("calendar_events").insert({wallet:account.toLowerCase(),date:dateKey,title,type,color});
    await loadCalendarEvents();showToast("Saved ✓","success");
  }
  $("schedEventTitle").value="";$("schedPayRecipient").value="";$("schedPayAmount").value="1";$("schedCustomLabel").value="";
  renderSchedCalendar();showSchedDayDetail(selectedSchedDay.d,selectedSchedDay.y,selectedSchedDay.m);
};
window.editSchedEvent=async(id,oldTitle,type)=>{const n=prompt("Edit "+(type||"event")+":",oldTitle);if(!n||n.trim()===oldTitle)return;await supabase.from("calendar_events").update({title:n.trim()}).eq("id",id);await loadCalendarEvents();renderSchedCalendar();if(selectedSchedDay)showSchedDayDetail(selectedSchedDay.d,selectedSchedDay.y,selectedSchedDay.m);showToast("Updated ✓","success");};
window.deleteSchedEvent=async id=>{await supabase.from("calendar_events").delete().eq("id",id);await loadCalendarEvents();renderSchedCalendar();if(selectedSchedDay)showSchedDayDetail(selectedSchedDay.d,selectedSchedDay.y,selectedSchedDay.m);showToast("Deleted","info");};

function renderSchedCalendar(){
  const year=currentCalDate.getFullYear(),month=currentCalDate.getMonth();
  $("schedCalendarTitle").textContent=new Date(year,month).toLocaleString("en-US",{month:"long",year:"numeric"});
  const firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate();
  const txByDay={},schedByDay={},eventsByDay={};
  allHistory.forEach(tx=>{const d=new Date(tx.created_at);if(d.getFullYear()===year&&d.getMonth()===month){const k=d.getDate();txByDay[k]=(txByDay[k]||0)+1;}});
  allScheduled.forEach(p=>{const d=new Date(p.scheduled_at);if(d.getFullYear()===year&&d.getMonth()===month){const k=d.getDate();schedByDay[k]=(schedByDay[k]||0)+1;}});
  allCalendarEvents.forEach(e=>{const[ey,em,ed]=e.date.split("-").map(Number);if(ey===year&&em===month+1){eventsByDay[ed]=eventsByDay[ed]||[];eventsByDay[ed].push(e);}});
  const dn=["Mo","Tu","We","Th","Fr","Sa","Su"];
  let html=dn.map(d=>'<div class="text-zinc-600 text-xs py-1.5 font-medium">'+d+'</div>').join("");
  const startOffset=(firstDay+6)%7;
  for(let i=0;i<startOffset;i++)html+="<div></div>";
  const today=new Date();
  const isSelMonth=selectedSchedDay&&selectedSchedDay.y===year&&selectedSchedDay.m===month;
  for(let day=1;day<=daysInMonth;day++){
    const isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===day;
    const isSelected=isSelMonth&&selectedSchedDay.d===day;
    const hasTx=txByDay[day],hasSched=schedByDay[day],hasEv=eventsByDay[day];
    const dots=[];
    if(hasTx)dots.push('<span class="w-1.5 h-1.5 rounded-full dot-accent inline-block"></span>');
    if(hasSched)dots.push('<span class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>');
    if(hasEv)hasEv.slice(0,3).forEach(e=>dots.push('<span class="w-1.5 h-1.5 rounded-full inline-block" style="background:'+e.color+'"></span>'));
    const evNames=hasEv?hasEv.slice(0,1).map(e=>'<div class="text-xs leading-tight truncate px-0.5 inline-flex items-center gap-1" style="color:'+e.color+'">'+(TYPE_ICONS[e.type]||TYPE_ICONS.note)+'<span class="truncate">'+e.title+'</span></div>').join(""):"";
    let cls="py-2 rounded-xl cursor-pointer flex flex-col items-center hover:bg-zinc-800/60 transition min-h-[56px] justify-start pt-1.5 ";
    if(isSelected)cls+="bg-accent-soft outline outline-2 outline-[var(--accent)] text-accent font-semibold ";
    else if(isToday)cls+="ring-1 ring-[var(--accent)]/70 bg-accent-soft text-accent font-semibold ";
    else cls+=(hasTx||hasSched||hasEv?"text-white ":"text-zinc-500 ");
    html+='<div onclick="showSchedDayDetail('+day+','+year+','+month+')" class="'+cls+'"><span class="text-xs">'+day+'</span>'+(dots.length?'<div class="flex gap-0.5 mt-0.5">'+dots.join("")+'</div>':'')+evNames+'</div>';
  }
  $("schedCalendarGrid").innerHTML=html;
}

window.showSchedDayDetail=(day,year,month)=>{
  selectedSchedDay={d:day,y:year,m:month};
  renderSchedCalendar();
  const dateKey=getDateKey(year,month,day);
  const txs=allHistory.filter(tx=>{const d=new Date(tx.created_at);return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day;});
  const scheds=allScheduled.filter(p=>{const d=new Date(p.scheduled_at);return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day;});
  const events=allCalendarEvents.filter(e=>e.date===dateKey);
  $("schedSelectedDate").textContent=new Date(year,month,day).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const total=txs.reduce((s,tx)=>s+parseFloat(tx.amount),0);
  $("schedDayTotal").textContent=txs.length?total.toFixed(2)+" USDC":"";
  let html="";
  events.forEach(e=>{
    html+='<div class="flex items-center justify-between p-2 rounded-xl text-xs" style="background:'+e.color+'18;border:1px solid '+e.color+'30">'+
    '<span class="inline-flex items-center gap-1.5">'+(TYPE_ICONS[e.type]||TYPE_ICONS.note)+' '+e.title+'</span>'+
    '<div class="flex gap-1.5 ml-2 shrink-0">'+
    '<button onclick="editSchedEvent('+e.id+',\''+e.title.replace(/'/g,"\\'")+'\',\''+e.type+'\')" class="text-zinc-500 hover:text-accent transition">✎</button>'+
    '<button onclick="deleteSchedEvent('+e.id+')" class="text-zinc-500 hover:text-red-400 transition">✕</button>'+
    '</div></div>';
  });
  scheds.forEach(p=>{html+='<div class="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 inline-flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>'+(getContactName(p.recipient)||p.recipient.slice(0,8)+"...")+" · "+p.amount+' USDC</div>';});
  txs.forEach(tx=>{
    html+='<div class="p-2 rounded-xl text-xs" style="background:var(--card);border:1px solid var(--border)">'+
    '<div class="flex justify-between items-start"><span class="text-zinc-300 font-medium">'+(getContactName(tx.recipient)||tx.recipient.slice(0,8)+"...")+'</span>'+
    '<span class="text-accent font-semibold ml-2 shrink-0">'+tx.amount+' USDC</span></div>'+
    (tx.memo?'<div class="text-zinc-500 text-xs mt-0.5 inline-flex items-center gap-1"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'+tx.memo+'</div>':'')+
    '</div>';
  });
  if(!html)html='<p class="text-zinc-600 text-xs text-center py-2">Nothing here yet</p>';
  $("schedDayContent").innerHTML=html;
  $("schedDayDetails").classList.remove("hidden");
};

// ─── SWAP ────────────────────────────────────────────────────────────
const SWAP_RELAYER_ADDRESS = "0x5556513A943F6d3Ab90802470aDDAD1775B9Baf0";
const SWAP_TOKENS = {
  USDC:   "0x3600000000000000000000000000000000000000",
  USDT:   "0x175CdB1D338945f0D851A741ccF787D343E57952",
  EURC:   "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  cirBTC: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
};
const DECIMALS_ABI = [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] }];

async function updateSwapBalances() {
  const inEl = $("swapBalanceIn"), outEl = $("swapBalanceOut");
  if (!account) { inEl.textContent = ""; outEl.textContent = ""; return; }
  try {
    const pc = createPublicClient({ chain: ARC_TESTNET, transport: http("https://rpc.testnet.arc.network") });
    const tokenIn = $("swapTokenIn").value, tokenOut = $("swapTokenOut").value;
    const [balIn, decIn, balOut, decOut] = await Promise.all([
      pc.readContract({ address: SWAP_TOKENS[tokenIn], abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
      pc.readContract({ address: SWAP_TOKENS[tokenIn], abi: DECIMALS_ABI, functionName: "decimals" }),
      pc.readContract({ address: SWAP_TOKENS[tokenOut], abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
      pc.readContract({ address: SWAP_TOKENS[tokenOut], abi: DECIMALS_ABI, functionName: "decimals" }),
    ]);
    inEl.textContent = "Balance: " + parseFloat(formatUnits(balIn, decIn)).toFixed(4);
    outEl.textContent = "Balance: " + parseFloat(formatUnits(balOut, decOut)).toFixed(4);
  } catch (e) { console.error("Swap balances:", e); }
}

let cachedSwapRates = null, cachedSwapRatesTime = 0;
async function getSwapRates() {
  if (cachedSwapRates && Date.now() - cachedSwapRatesTime < 60000) return cachedSwapRates;
  const [fx, btc] = await Promise.all([
    fetch("https://open.er-api.com/v6/latest/USD").then(r => r.json()),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd").then(r => r.json()),
  ]);
  cachedSwapRates = { EURC: fx.rates.EUR, cirBTC: btc.bitcoin.usd, USDC: 1, USDT: 1 };
  cachedSwapRatesTime = Date.now();
  return cachedSwapRates;
}
function swapToUSD(symbol, amount, rates) { if (symbol === "EURC") return amount / rates.EURC; if (symbol === "cirBTC") return amount * rates.cirBTC; return amount; }
function swapFromUSD(symbol, usd, rates) { if (symbol === "EURC") return usd * rates.EURC; if (symbol === "cirBTC") return usd / rates.cirBTC; return usd; }

let swapEstimateTimer = null;
function scheduleSwapEstimate() { clearTimeout(swapEstimateTimer); swapEstimateTimer = setTimeout(updateSwapEstimate, 300); }
async function updateSwapEstimate() {
  const tokenIn = $("swapTokenIn").value, tokenOut = $("swapTokenOut").value;
  const amount = parseFloat($("swapAmount").value) || 0;
  if (tokenIn === tokenOut || !amount) { $("swapEstimateOut").textContent = "0.00"; $("swapRateInfo").textContent = ""; return; }
  try {
    const rates = await getSwapRates();
    const out = swapFromUSD(tokenOut, swapToUSD(tokenIn, amount, rates), rates);
    $("swapEstimateOut").textContent = out.toFixed(6);
    const unitRate = swapFromUSD(tokenOut, swapToUSD(tokenIn, 1, rates), rates);
    $("swapRateInfo").textContent = "1 " + tokenIn + " ≈ " + unitRate.toFixed(6) + " " + tokenOut;
  } catch (e) { $("swapRateInfo").textContent = "Rate unavailable"; }
}

$("swapAmount").addEventListener("input", scheduleSwapEstimate);
$("swapTokenIn").addEventListener("change", () => { updateSwapBalances(); scheduleSwapEstimate(); });
$("swapTokenOut").addEventListener("change", () => { updateSwapBalances(); scheduleSwapEstimate(); });
scheduleSwapEstimate();

$("swapDirectionBtn").onclick = () => {
  const a = $("swapTokenIn").value, b = $("swapTokenOut").value;
  $("swapTokenIn").value = b; $("swapTokenOut").value = a;
  updateSwapBalances(); scheduleSwapEstimate();
};

$("swapBtn").onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const tokenIn = $("swapTokenIn").value, tokenOut = $("swapTokenOut").value;
  const amount = $("swapAmount").value;
  if (tokenIn === tokenOut) { showToast("Choose two different tokens", "error"); return; }
  if (!amount || parseFloat(amount) <= 0) { showToast("Enter a valid amount", "error"); return; }

  const btn = $("swapBtn"), status = $("swapStatus");
  btn.disabled = true; status.classList.remove("hidden");
  try {
    const pc = createPublicClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
    const decIn = await pc.readContract({ address: SWAP_TOKENS[tokenIn], abi: DECIMALS_ABI, functionName: "decimals" });

    status.textContent = "Step 1/2: sending " + tokenIn + " deposit...";
    btn.textContent = "⏳ Depositing...";
    const wc = createWalletClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
    const data = encodeFunctionData({
      abi: ERC20_ABI, functionName: "transfer",
      args: [SWAP_RELAYER_ADDRESS, parseUnits(amount, decIn)],
    });
    const depositTxHash = await wc.sendTransaction({ account, to: SWAP_TOKENS[tokenIn], data });

    status.textContent = "Step 2/2: calculating rate & sending payout...";
    btn.textContent = "⏳ Swapping...";
    const resp = await fetch("/api/swap", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: account, depositTxHash, tokenIn, tokenOut, amountIn: amount }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || "Swap failed");

    showToast('<div>Swapped! Received <b>' + result.amountOut + ' ' + tokenOut + '</b></div>' + txLink(result.payoutTxHash), "success");
    await Promise.all([loadBalance(), updateSwapBalances(), loadSwapHistory()]);
    status.classList.add("hidden");
  } catch (err) {
    showToast("Swap error: " + err.message, "error");
    status.textContent = "Error — see toast above";
  } finally {
    btn.disabled = false; btn.textContent = "Swap →";
  }
};

// ─── SWAP HISTORY ────────────────────────────────────────────────────
async function loadSwapHistory() {
  if (!account) return;
  const { data } = await supabase.from("swaps").select("*").eq("wallet", account.toLowerCase()).order("created_at", { ascending: false }).limit(50);
  renderSwapHistory(data || []);
}
let swapHistoryExpanded = false, lastSwapHistoryFull = [];
const SWAP_HISTORY_PAGE_SIZE = 10;
function renderSwapHistory(items) {
  lastSwapHistoryFull = items;
  const el = $("swapHistoryList"), toggleWrap = $("swapHistoryToggleWrap");
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="text-center py-8 t3 text-sm">No swaps yet</div>';
    if (toggleWrap) toggleWrap.innerHTML = "";
    return;
  }
  const statusColor = { done: "#009dbd", pending: "#f59e0b", failed: "#ef4444" };
  const shown = swapHistoryExpanded ? items : items.slice(0, SWAP_HISTORY_PAGE_SIZE);
  el.innerHTML = shown.map(s => {
    const color = statusColor[s.status] || "#6b7280";
    const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return (
      '<div class="flex items-center gap-2 px-3 py-2 rounded-xl border bdr text-xs" style="background:var(--card)">' +
      '<span class="px-2 py-0.5 rounded-lg text-xs font-semibold shrink-0" style="background:' + color + '22;color:' + color + '">' + s.status + '</span>' +
      '<span class="flex-1 min-w-0 truncate font-medium">' + s.token_in + ' → ' + s.token_out + '</span>' +
      '<span class="text-accent font-semibold shrink-0">' + s.amount_in + ' ' + s.token_in + (s.amount_out ? ' → ' + parseFloat(s.amount_out).toFixed(4) + ' ' + s.token_out : '') + '</span>' +
      '<span class="t3 shrink-0">' + date + '</span>' +
      (s.payout_txhash ? '<a href="https://testnet.arcscan.app/tx/' + s.payout_txhash + '" target="_blank" class="t3 hover:text-accent transition shrink-0">↗</a>' : '') +
      '</div>'
    );
  }).join("");
  if (toggleWrap) {
    if (items.length > SWAP_HISTORY_PAGE_SIZE) {
      toggleWrap.innerHTML = '<button onclick="toggleSwapHistoryExpand()" class="w-full text-xs t3 hover:text-accent transition py-2 text-center">' +
        (swapHistoryExpanded ? "▲ Show less" : "▼ Show " + (items.length - SWAP_HISTORY_PAGE_SIZE) + " more") + '</button>';
    } else {
      toggleWrap.innerHTML = "";
    }
  }
}
window.toggleSwapHistoryExpand = () => { swapHistoryExpanded = !swapHistoryExpanded; renderSwapHistory(lastSwapHistoryFull); };

// ─── PAGE NAVIGATION (Send / Scheduled / Swap / NFT Gifts) ────────────
const PAGES = ["send", "scheduled", "swap", "nft"];
function initPageNav() {
  const historyCardEl = $("historyCard");
  const schedCardEl = $("scheduledPaymentsCard");
  document.querySelectorAll(".page-tab").forEach(btn => {
    btn.onclick = () => {
      const page = btn.dataset.page;
      PAGES.forEach(p => {
        $("page-" + p).classList.toggle("hidden", p !== page);
        document.querySelector('.page-tab[data-page="' + p + '"]').classList.toggle("page-tab-active", p === page);
      });
      if (page === "send") { $("sendHistorySlot").appendChild(historyCardEl); $("sendSchedSlot").appendChild(schedCardEl); }
      if (page === "scheduled") { $("schedHistorySlot").appendChild(historyCardEl); $("schedPaymentsSlot").appendChild(schedCardEl); }
    };
  });
}