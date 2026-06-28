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

const DEFAULT_CATEGORY_COLORS = {
  Payment: "#10b981", Gift: "#f59e0b", Work: "#3b82f6", Other: "#6b7280"
};

const $ = id => document.getElementById(id);
const connectBtn        = $("connectBtn");
const walletStatus      = $("walletStatus");
const sendBtn           = $("sendBtn");
const recipientInput    = $("recipient");
const amountInput       = $("amount");
const memoInput         = $("memo");
const categoryInput     = $("category");
const categoryColorDot  = $("categoryColorDot");
const historyList       = $("historyList");
const contactsList      = $("contactsList");
const contactNameEl     = $("contactName");
const contactAddressEl  = $("contactAddress");
const addContactBtn     = $("addContactBtn");
const chooseContactBtn  = $("chooseContactBtn");
const searchInput       = $("searchInput");
const exportBtn         = $("exportBtn");
const clearHistoryBtn   = $("clearHistoryBtn");
const calendarBtn       = $("calendarBtn");
const calendarModal     = $("calendarModal");
const closeCalendar     = $("closeCalendar");
const prevMonth         = $("prevMonth");
const nextMonth         = $("nextMonth");
const calendarTitle     = $("calendarTitle");
const calendarGrid      = $("calendarGrid");
const dayDetails        = $("dayDetails");
const selectedDateEl    = $("selectedDate");
const dayTotalEl        = $("dayTotal");
const dayTransactionsEl = $("dayTransactions");
const savedCategoriesBar   = $("savedCategoriesBar");
const savedCategoriesList  = $("savedCategoriesList");
const newCategoryInput     = $("newCategoryInput");
const newCategoryColor     = $("newCategoryColor");
const addCategoryBtn       = $("addCategoryBtn");
const toggleScheduleForm   = $("toggleScheduleForm");
const scheduleForm         = $("scheduleForm");
const saveScheduleBtn      = $("saveScheduleBtn");
const cancelScheduleBtn    = $("cancelScheduleBtn");
const schedRecipient       = $("schedRecipient");
const schedAmount          = $("schedAmount");
const schedDateTime        = $("schedDateTime");
const schedRepeat          = $("schedRepeat");
const schedMemo            = $("schedMemo");
const scheduledList        = $("scheduledList");
const eventTitle           = $("eventTitle");
const eventType            = $("eventType");
const eventColor           = $("eventColor");
const saveEventBtn         = $("saveEventBtn");
const eventPaymentFields   = $("eventPaymentFields");
const eventPayRecipient    = $("eventPayRecipient");
const eventPayAmount       = $("eventPayAmount");

let account = null;
let allHistory = [];
let allContacts = [];
let allCategories = [];
let allCalendarEvents = [];
let allScheduled = [];
let currentCalDate = new Date();
let selectedCalDay = null;

// ─── TOAST ───────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const old = $("toast"); if (old) old.remove();
  const colors = {
    success: "bg-emerald-500 text-black",
    error: "bg-red-500 text-white",
    info: "bg-zinc-800 text-zinc-200 border border-zinc-700"
  };
  const t = document.createElement("div");
  t.id = "toast";
  t.className = "fixed top-5 right-5 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium max-w-xs " + colors[type];
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition="opacity 0.4s"; t.style.opacity="0"; setTimeout(()=>t.remove(),400); }, 4000);
}

// ─── CONTACT MODAL ───────────────────────────────────────────────────
function createContactModal() {
  if ($("contactModal")) return;
  const m = document.createElement("div");
  m.id = "contactModal";
  m.className = "hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50";
  m.innerHTML = `
    <div class="bg-zinc-900 border border-zinc-700/80 rounded-3xl w-full max-w-sm p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold">Choose a contact</h3>
        <button id="closeContactModal" class="text-zinc-500 hover:text-white transition text-lg">✕</button>
      </div>
      <input id="contactSearchModal" type="text" placeholder="Search by name or address..."
        class="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-2xl px-4 py-2.5 text-sm outline-none transition mb-3 placeholder:text-zinc-600">
      <div id="contactModalList" class="space-y-2 max-h-64 overflow-y-auto"></div>
    </div>`;
  document.body.appendChild(m);
  $("closeContactModal").onclick = () => m.classList.add("hidden");
  m.onclick = e => { if (e.target === m) m.classList.add("hidden"); };
  $("contactSearchModal").addEventListener("input", e => renderContactModalList(e.target.value));
}

function renderContactModalList(q = "") {
  const list = $("contactModalList");
  const filtered = allContacts.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.address.toLowerCase().includes(q.toLowerCase())
  );
  if (!filtered.length) { list.innerHTML = '<p class="text-zinc-600 text-xs text-center py-6">No contacts found</p>'; return; }
  list.innerHTML = filtered.map(c =>
    '<div onclick="pickContact(\'' + c.address + '\',\'' + c.name + '\')" ' +
    'class="flex items-center gap-3 p-3 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-2xl cursor-pointer transition border border-transparent hover:border-zinc-600">' +
    '<div class="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-semibold text-xs shrink-0">' + c.name.slice(0,2).toUpperCase() + '</div>' +
    '<div class="flex-1 min-w-0"><div class="text-sm font-medium">' + c.name + '</div>' +
    '<div class="font-mono text-xs text-zinc-500 truncate">' + c.address + '</div></div>' +
    '<span class="text-emerald-500 text-xs">→</span></div>'
  ).join("");
}

window.pickContact = (address, name) => {
  recipientInput.value = address;
  $("contactModal").classList.add("hidden");
  showToast("Selected: " + name, "info");
};

// ─── CATEGORIES ──────────────────────────────────────────────────────
function getCategoryColor(name) {
  if (DEFAULT_CATEGORY_COLORS[name]) return DEFAULT_CATEGORY_COLORS[name];
  const cat = allCategories.find(c => c.name === name);
  return cat ? cat.color : "#6b7280";
}

function updateCategoryColorDot() {
  categoryColorDot.style.background = getCategoryColor(categoryInput.value);
}

categoryInput.addEventListener("change", updateCategoryColorDot);

async function loadCategories() {
  if (!account) return;
  const { data } = await supabase.from("categories").select("*")
    .eq("wallet", account.toLowerCase()).order("created_at", { ascending: true });
  allCategories = data || [];
  rebuildCategorySelect();
  renderSavedCategories();
  savedCategoriesBar.classList.remove("hidden");
  updateCategoryColorDot();
}

function rebuildCategorySelect() {
  const defaults = ["Payment","Gift","Work","Other"];
  const current = categoryInput.value;
  categoryInput.innerHTML = "";
  [...defaults, ...allCategories.map(c => c.name)].forEach(name => {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    if (name === current) o.selected = true;
    categoryInput.appendChild(o);
  });
}

function renderSavedCategories() {
  if (!allCategories.length) {
    savedCategoriesList.innerHTML = '<span class="text-xs text-zinc-600">No custom categories yet</span>';
    return;
  }
  savedCategoriesList.innerHTML = allCategories.map(c =>
    '<div class="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border border-zinc-700/60 group" style="background:' + c.color + '22">' +
    '<span class="w-2 h-2 rounded-full shrink-0" style="background:' + c.color + '"></span>' +
    '<button onclick="selectCategory(\'' + c.name + '\')" class="text-xs text-zinc-300 hover:text-white transition">' + c.name + '</button>' +
    '<button onclick="renameCategory(' + c.id + ',\'' + c.name + '\')" class="text-zinc-600 hover:text-blue-400 text-xs ml-1 transition">✎</button>' +
    '<button onclick="deleteCategoryById(' + c.id + ')" class="text-zinc-600 hover:text-red-400 text-xs transition">✕</button>' +
    '</div>'
  ).join("");
}

window.selectCategory = name => {
  categoryInput.value = name;
  updateCategoryColorDot();
  showToast("Category: " + name, "info");
};

window.renameCategory = async (id, oldName) => {
  const newName = prompt('Rename "' + oldName + '" to:', oldName);
  if (!newName || newName.trim() === oldName) return;
  const { error } = await supabase.from("categories").update({ name: newName.trim() }).eq("id", id);
  if (error) { showToast("Error: " + error.message, "error"); return; }
  await loadCategories();
  showToast("Renamed to: " + newName.trim(), "success");
};

window.deleteCategoryById = async id => {
  if (!confirm("Delete this category?")) return;
  await supabase.from("categories").delete().eq("id", id);
  await loadCategories();
  showToast("Category deleted", "info");
};

addCategoryBtn.onclick = async () => {
  const name = newCategoryInput.value.trim();
  const color = newCategoryColor.value;
  if (!name) { showToast("Enter a category name", "error"); return; }
  if (!account) { showToast("Connect wallet first", "error"); return; }
  if (allCategories.find(c => c.name.toLowerCase() === name.toLowerCase())) { showToast("Already exists", "info"); return; }
  const { error } = await supabase.from("categories").insert({ wallet: account.toLowerCase(), name, color });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  newCategoryInput.value = "";
  await loadCategories();
  showToast("Category saved: " + name, "success");
};

newCategoryInput.addEventListener("keydown", e => { if (e.key === "Enter") addCategoryBtn.click(); });

// ─── AUTO-CONNECT ────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  createContactModal();
  rebuildCategorySelect();
  updateCategoryColorDot();
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      account = accounts[0];
      updateWalletUI();
      await switchToArc();
      await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories(), loadScheduled(), loadCalendarEvents()]);
    }
  } catch (e) { console.log("Auto-connect:", e); }
});

// ─── CONNECT / DISCONNECT ─────────────────────────────────────────────
connectBtn.onclick = async () => {
  if (!window.ethereum) { showToast("Please install MetaMask: metamask.io", "error"); return; }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0];
    updateWalletUI();
    await switchToArc();
    await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories(), loadScheduled(), loadCalendarEvents()]);
  } catch (err) { showToast("Connection error: " + err.message, "error"); }
};

function updateWalletUI() {
  walletStatus.innerHTML = '<span class="text-emerald-400 font-mono text-xs">' + account.slice(0,6) + "..." + account.slice(-4) + "</span>";
  connectBtn.textContent = "Disconnect";
  connectBtn.className = "px-5 py-2.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 text-sm font-medium rounded-2xl transition border border-zinc-700";
  connectBtn.onclick = disconnectWallet;
}

function disconnectWallet() {
  account = null; allHistory = []; allContacts = []; allCategories = []; allCalendarEvents = [];
  walletStatus.innerHTML = "";
  $("balanceDisplay").textContent = "";
  savedCategoriesBar.classList.add("hidden");
  connectBtn.textContent = "Connect Wallet";
  connectBtn.className = "px-5 py-2.5 bg-white text-black text-sm font-medium rounded-2xl hover:bg-zinc-100 transition";
  connectBtn.onclick = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accounts[0]; updateWalletUI(); await switchToArc();
      await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories(), loadScheduled(), loadCalendarEvents()]);
    } catch (err) { showToast("Error: " + err.message, "error"); }
  };
  renderHistory([]); renderContacts([]);
  scheduledList.innerHTML = '<div class="text-center py-8 text-zinc-600 text-xs">No scheduled payments</div>';
  showToast("Wallet disconnected", "info");
}

// ─── BALANCE ─────────────────────────────────────────────────────────
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

// ─── SEND ────────────────────────────────────────────────────────────
sendBtn.onclick = async () => {
  if (!account) { showToast("Please connect your wallet first!", "error"); return; }
  const to = recipientInput.value.trim();
  const amount = amountInput.value;
  const memo = memoInput.value.trim();
  const category = categoryInput.value;
  if (!to || !amount) { showToast("Please fill in recipient and amount", "error"); return; }
  try {
    sendBtn.textContent = "⏳ Sending..."; sendBtn.disabled = true;
    const wc = createWalletClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to, parseUnits(amount, 6)] });
    const hash = await wc.sendTransaction({ account, to: USDC_ADDRESS, data });
    await supabase.from("transactions").insert({
      wallet: account.toLowerCase(), recipient: to, amount: parseFloat(amount), memo, category, txhash: hash,
    });
    await Promise.all([loadHistory(), loadBalance()]);
    const short = hash.slice(0,8) + "..." + hash.slice(-6);
    showToast('✅ Sent ' + amount + ' USDC!<br><a href="https://testnet.arcscan.app/tx/' + hash + '" target="_blank" class="underline opacity-80">' + short + ' ↗</a>', "success");
    recipientInput.value = ""; memoInput.value = ""; amountInput.value = "1";
  } catch (err) { showToast("Error: " + err.message, "error"); }
  finally { sendBtn.textContent = "Send with Memo →"; sendBtn.disabled = false; }
};

// ─── HISTORY ─────────────────────────────────────────────────────────
async function loadHistory() {
  if (!account) return;
  const { data } = await supabase.from("transactions").select("*")
    .eq("wallet", account.toLowerCase()).order("created_at", { ascending: false });
  allHistory = data || [];
  renderHistory(allHistory);
}

function getContactName(addr) {
  const c = allContacts.find(c => c.address.toLowerCase() === addr.toLowerCase());
  return c ? c.name : null;
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = '<div class="text-center py-12 text-zinc-600"><div class="text-3xl mb-2">◌</div><div class="text-sm">No transactions yet</div></div>';
    return;
  }
  historyList.innerHTML = items.map(tx => {
    const name = getContactName(tx.recipient);
    const avatar = name ? name.slice(0,2).toUpperCase() : tx.recipient.slice(2,4).toUpperCase();
    const color = getCategoryColor(tx.category);
    return (
      '<div class="flex items-start gap-3 p-3.5 bg-zinc-800/40 hover:bg-zinc-800/70 rounded-2xl border border-zinc-800/60 hover:border-zinc-700/60 transition">' +
      '<div class="w-9 h-9 rounded-full bg-zinc-700/60 flex items-center justify-center text-xs font-semibold text-zinc-400 shrink-0 mt-0.5">' + avatar + '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div>' + (name ? '<div class="text-sm font-medium">' + name + '</div>' : '') +
      '<div class="font-mono text-xs text-zinc-500">' + tx.recipient.slice(0,8) + "..." + tx.recipient.slice(-6) + '</div></div>' +
      '<div class="text-right shrink-0">' +
      '<div class="text-sm font-semibold text-emerald-400">' + tx.amount + ' USDC</div>' +
      (tx.txhash ? '<a href="https://testnet.arcscan.app/tx/' + tx.txhash + '" target="_blank" class="text-xs text-zinc-600 hover:text-blue-400 transition">tx ↗</a>' : '') +
      '</div></div>' +
      (tx.memo ? '<div class="text-xs text-zinc-500 mt-1.5 bg-zinc-900/60 rounded-xl px-2.5 py-1.5">💬 ' + tx.memo + '</div>' : '') +
      '<div class="flex items-center gap-2 mt-1.5">' +
      '<span class="text-xs text-zinc-600">' + new Date(tx.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + '</span>' +
      '<span class="w-1 h-1 bg-zinc-700 rounded-full"></span>' +
      '<span class="text-xs px-2 py-0.5 rounded-lg font-medium" style="background:' + color + '22;color:' + color + '">📂 ' + tx.category + '</span>' +
      '</div></div></div>'
    );
  }).join("");
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  renderHistory(allHistory.filter(tx =>
    tx.recipient.toLowerCase().includes(q) ||
    (tx.memo && tx.memo.toLowerCase().includes(q)) ||
    tx.category.toLowerCase().includes(q) ||
    (getContactName(tx.recipient)||"").toLowerCase().includes(q)
  ));
});

exportBtn.onclick = () => {
  if (!allHistory.length) { showToast("No transactions to export", "info"); return; }
  const rows = [["Date","Contact","Recipient","Amount","Memo","Category","TxHash"],
    ...allHistory.map(tx => [new Date(tx.created_at).toLocaleString("en"), getContactName(tx.recipient)||"", tx.recipient, tx.amount, tx.memo||"", tx.category, tx.txhash||""])];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));
  a.download = "arcmemo.csv"; a.click();
  showToast("CSV downloaded ✓", "success");
};

clearHistoryBtn.onclick = async () => {
  if (!account || !confirm("Delete all transaction history?")) return;
  await supabase.from("transactions").delete().eq("wallet", account.toLowerCase());
  allHistory = []; renderHistory([]);
  showToast("History cleared", "info");
};

// ─── CONTACTS ────────────────────────────────────────────────────────
addContactBtn.onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const name = contactNameEl.value.trim(), address = contactAddressEl.value.trim();
  if (!name || !address) { showToast("Fill in name and address", "error"); return; }
  const { error } = await supabase.from("contacts").insert({ wallet: account.toLowerCase(), name, address });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  contactNameEl.value = ""; contactAddressEl.value = "";
  await loadContacts();
  showToast("Contact added ✓", "success");
};

async function loadContacts() {
  if (!account) return;
  const { data } = await supabase.from("contacts").select("*")
    .eq("wallet", account.toLowerCase()).order("created_at", { ascending: true });
  allContacts = data || [];
  renderContacts(allContacts);
  renderHistory(allHistory);
}

function renderContacts(contacts) {
  if (!contacts.length) {
    contactsList.innerHTML = '<p class="text-zinc-600 text-xs py-2 col-span-2">No contacts yet</p>';
    return;
  }
  contactsList.innerHTML = contacts.map(c =>
    '<div class="flex items-center justify-between p-3 bg-zinc-800/40 hover:bg-zinc-800/70 rounded-2xl border border-zinc-800/60 transition group">' +
    '<div class="flex items-center gap-2.5">' +
    '<div class="w-8 h-8 rounded-full bg-zinc-700/60 text-zinc-400 flex items-center justify-center font-semibold text-xs">' + c.name.slice(0,2).toUpperCase() + '</div>' +
    '<div><div class="text-sm font-medium">' + c.name + '</div>' +
    '<div class="font-mono text-xs text-zinc-600">' + c.address.slice(0,6) + "..." + c.address.slice(-4) + '</div></div></div>' +
    '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">' +
    '<button onclick="useContact(\'' + c.address + '\',\'' + c.name + '\')" class="text-xs px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition">Send</button>' +
    '<button onclick="deleteContact(' + c.id + ')" class="text-xs px-2.5 py-1 bg-zinc-700/50 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition">✕</button>' +
    '</div></div>'
  ).join("");
}

window.useContact = (address, name) => {
  recipientInput.value = address;
  showToast("Selected: " + name, "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteContact = async id => {
  await supabase.from("contacts").delete().eq("id", id);
  await loadContacts();
  showToast("Contact deleted", "info");
};

chooseContactBtn.onclick = () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  if (!allContacts.length) { showToast("No contacts yet", "info"); return; }
  $("contactSearchModal").value = "";
  renderContactModalList("");
  $("contactModal").classList.remove("hidden");
};

// ─── SCHEDULED ───────────────────────────────────────────────────────
function setDefaultDateTime() {
  const d = new Date(Date.now() + 60*60*1000);
  const pad = n => String(n).padStart(2,"0");
  schedDateTime.value = d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
}

toggleScheduleForm.onclick = () => {
  scheduleForm.classList.toggle("hidden");
  if (!scheduleForm.classList.contains("hidden")) setDefaultDateTime();
};
cancelScheduleBtn.onclick = () => scheduleForm.classList.add("hidden");

saveScheduleBtn.onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const recipient = schedRecipient.value.trim(), amount = schedAmount.value, dateTime = schedDateTime.value, repeat = schedRepeat.value, memo = schedMemo.value.trim();
  if (!recipient || !amount || !dateTime) { showToast("Fill in all required fields", "error"); return; }
  const { error } = await supabase.from("scheduled_payments").insert({
    wallet: account.toLowerCase(), recipient, amount: parseFloat(amount),
    memo, category: "Payment", scheduled_at: new Date(dateTime).toISOString(), repeat_type: repeat, status: "pending",
  });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  scheduleForm.classList.add("hidden");
  schedRecipient.value = ""; schedMemo.value = ""; schedAmount.value = "1";
  await loadScheduled();
  showToast("Payment scheduled ✓", "success");
};

async function loadScheduled() {
  if (!account) return;
  const { data } = await supabase.from("scheduled_payments").select("*")
    .eq("wallet", account.toLowerCase()).eq("status", "pending")
    .order("scheduled_at", { ascending: true });
  allScheduled = data || [];
  renderScheduled(allScheduled);
  allScheduled.forEach(p => scheduleNotification(p));
}

function renderScheduled(items) {
  if (!items.length) { scheduledList.innerHTML = '<div class="text-center py-8 text-zinc-600 text-xs">No scheduled payments</div>'; return; }
  const labels = { once:"One time", daily:"Daily", weekly:"Weekly", monthly:"Monthly" };
  scheduledList.innerHTML = items.map(p => {
    const dt = new Date(p.scheduled_at), isDue = dt <= new Date(), name = getContactName(p.recipient);
    return (
      '<div class="flex items-start gap-3 p-4 rounded-2xl border ' + (isDue ? 'border-violet-500/40 bg-violet-500/5' : 'border-zinc-700/50 bg-zinc-800/30') + '">' +
      '<div class="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ' + (isDue ? 'bg-violet-500/20 text-violet-400' : 'bg-zinc-700/60 text-zinc-400') + '">⏰</div>' +
      '<div class="flex-1 min-w-0"><div class="flex items-start justify-between gap-2">' +
      '<div><div class="text-sm font-medium">' + (name || p.recipient.slice(0,8)+"..."+p.recipient.slice(-4)) + '</div>' +
      '<div class="text-xs text-zinc-500 mt-0.5">' + dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + " · " + dt.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}) + '</div></div>' +
      '<div class="text-right shrink-0"><div class="text-sm font-semibold text-violet-400">' + p.amount + ' USDC</div><div class="text-xs text-zinc-600">' + labels[p.repeat_type] + '</div></div></div>' +
      (p.memo ? '<div class="text-xs text-zinc-600 mt-1.5">💬 ' + p.memo + '</div>' : '') +
      '<div class="flex gap-2 mt-3">' +
      (isDue
        ? '<button onclick="executeScheduled(' + p.id + ',\'' + p.recipient + '\',' + p.amount + ',\'' + (p.memo||"") + '\',\'' + p.category + '\',\'' + p.repeat_type + '\')" class="flex-1 py-2 bg-violet-500/20 hover:bg-violet-500/40 border border-violet-500/30 text-violet-300 text-xs font-medium rounded-xl transition">⚡ Send Now — confirm in MetaMask</button>'
        : '<div class="flex-1 py-2 text-center text-zinc-600 text-xs border border-zinc-800 rounded-xl">Waiting...</div>'
      ) +
      '<button onclick="deleteScheduled(' + p.id + ')" class="px-3 py-2 bg-zinc-700/40 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 text-xs rounded-xl transition">✕</button>' +
      '</div></div></div>'
    );
  }).join("");
}

window.executeScheduled = async (id, recipient, amount, memo, category, repeatType) => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  showToast("Opening MetaMask...", "info");
  try {
    const wc = createWalletClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [recipient, parseUnits(String(amount), 6)] });
    const hash = await wc.sendTransaction({ account, to: USDC_ADDRESS, data });
    await supabase.from("transactions").insert({ wallet: account.toLowerCase(), recipient, amount: parseFloat(amount), memo, category, txhash: hash });
    if (repeatType === "once") {
      await supabase.from("scheduled_payments").update({ status: "done" }).eq("id", id);
    } else {
      const next = new Date();
      if (repeatType === "daily") next.setDate(next.getDate()+1);
      if (repeatType === "weekly") next.setDate(next.getDate()+7);
      if (repeatType === "monthly") next.setMonth(next.getMonth()+1);
      await supabase.from("scheduled_payments").update({ scheduled_at: next.toISOString() }).eq("id", id);
    }
    await Promise.all([loadHistory(), loadBalance(), loadScheduled()]);
    const short = hash.slice(0,8)+"..."+hash.slice(-6);
    showToast('✅ Sent ' + amount + ' USDC!<br><a href="https://testnet.arcscan.app/tx/'+hash+'" target="_blank" class="underline opacity-80">'+short+' ↗</a>', "success");
  } catch (err) { showToast("Error: " + err.message, "error"); }
};

window.deleteScheduled = async id => {
  if (!confirm("Cancel this scheduled payment?")) return;
  await supabase.from("scheduled_payments").update({ status: "cancelled" }).eq("id", id);
  await loadScheduled();
  showToast("Schedule cancelled", "info");
};

function scheduleNotification(p) {
  const msUntil = new Date(p.scheduled_at) - new Date();
  if (msUntil > 0 && msUntil < 60*60*1000) {
    setTimeout(() => {
      showToast('⏰ Payment due: ' + p.amount + ' USDC → ' + (getContactName(p.recipient)||p.recipient.slice(0,8)+"..."), "info");
      loadScheduled();
    }, msUntil);
  }
}

setInterval(() => { if (account) loadScheduled(); }, 60000);

// ─── CALENDAR EVENTS ─────────────────────────────────────────────────
async function loadCalendarEvents() {
  if (!account) return;
  const { data } = await supabase.from("calendar_events").select("*")
    .eq("wallet", account.toLowerCase());
  allCalendarEvents = data || [];
}

const typeIcons = { note:"📝", event:"🎯", holiday:"🎉", payment:"💸" };
const typeColors = { note:"#60a5fa", event:"#fb923c", holiday:"#f472b6", payment:"#a78bfa" };

eventType.addEventListener("change", () => {
  eventPaymentFields.classList.toggle("hidden", eventType.value !== "payment");
  eventColor.value = typeColors[eventType.value] || "#6366f1";
});

saveEventBtn.onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  if (!selectedCalDay) { showToast("Select a day first", "error"); return; }
  const title = eventTitle.value.trim();
  if (!title) { showToast("Enter a title", "error"); return; }
  const type = eventType.value;
  const color = eventColor.value;

  if (type === "payment") {
    const recipient = eventPayRecipient.value.trim();
    const amount = eventPayAmount.value;
    if (!recipient || !amount) { showToast("Fill in recipient and amount", "error"); return; }
    const pad = n => String(n).padStart(2,"0");
    const dateStr = selectedCalDay.year+"-"+pad(selectedCalDay.month+1)+"-"+pad(selectedCalDay.day)+"T09:00";
    const { error } = await supabase.from("scheduled_payments").insert({
      wallet: account.toLowerCase(), recipient, amount: parseFloat(amount),
      memo: title, category: "Payment",
      scheduled_at: new Date(dateStr).toISOString(),
      repeat_type: "once", status: "pending",
    });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await loadScheduled();
    showToast("Payment scheduled from calendar ✓", "success");
  } else {
    const pad = n => String(n).padStart(2,"0");
    const dateKey = selectedCalDay.year+"-"+pad(selectedCalDay.month+1)+"-"+pad(selectedCalDay.day);
    const { error } = await supabase.from("calendar_events").insert({
      wallet: account.toLowerCase(), date: dateKey, title, type, color,
    });
    if (error) { showToast("Error: " + error.message, "error"); return; }
    await loadCalendarEvents();
    showToast("Saved ✓", "success");
  }

  eventTitle.value = ""; eventPayRecipient.value = ""; eventPayAmount.value = "1";
  renderCalendar();
  showDayDetails(selectedCalDay.day, selectedCalDay.year, selectedCalDay.month);
};

window.deleteCalEvent = async id => {
  await supabase.from("calendar_events").delete().eq("id", id);
  await loadCalendarEvents();
  renderCalendar();
  if (selectedCalDay) showDayDetails(selectedCalDay.day, selectedCalDay.year, selectedCalDay.month);
  showToast("Deleted", "info");
};

// ─── CALENDAR ────────────────────────────────────────────────────────
calendarBtn.onclick = () => { calendarModal.classList.remove("hidden"); renderCalendar(); };
closeCalendar.onclick = () => calendarModal.classList.add("hidden");
prevMonth.onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderCalendar(); dayDetails.classList.add("hidden"); };
nextMonth.onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderCalendar(); dayDetails.classList.add("hidden"); };

function getDateKey(year, month, day) {
  const pad = n => String(n).padStart(2,"0");
  return year+"-"+pad(month+1)+"-"+pad(day);
}

function renderCalendar() {
  const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
  calendarTitle.textContent = new Date(year,month).toLocaleString("en-US",{month:"long",year:"numeric"});
  const firstDay = new Date(year,month,1).getDay(), daysInMonth = new Date(year,month+1,0).getDate();

  const txByDay = {}, schedByDay = {}, eventsByDay = {};
  allHistory.forEach(tx => {
    const d = new Date(tx.created_at);
    if (d.getFullYear()===year && d.getMonth()===month) {
      const k = d.getDate(); txByDay[k] = (txByDay[k]||0)+1;
    }
  });
  allScheduled.forEach(p => {
    const d = new Date(p.scheduled_at);
    if (d.getFullYear()===year && d.getMonth()===month) {
      const k = d.getDate(); schedByDay[k] = (schedByDay[k]||0)+1;
    }
  });
  allCalendarEvents.forEach(e => {
    const [ey, em, ed] = e.date.split("-").map(Number);
    if (ey===year && em===month+1) { eventsByDay[ed] = eventsByDay[ed]||[]; eventsByDay[ed].push(e); }
  });

  const dn = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  let html = dn.map(d => '<div class="text-zinc-600 text-xs py-1.5 font-medium">' + d + '</div>').join("");
  for (let i=0; i<firstDay; i++) html += "<div></div>";
  const today = new Date();

  for (let day=1; day<=daysInMonth; day++) {
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===day;
    const hasTx = txByDay[day], hasSched = schedByDay[day], hasEvents = eventsByDay[day];
    const dots = [];
    if (hasTx) dots.push('<span class="w-1 h-1 rounded-full bg-emerald-500 inline-block"></span>');
    if (hasSched) dots.push('<span class="w-1 h-1 rounded-full bg-violet-500 inline-block"></span>');
    if (hasEvents) hasEvents.slice(0,2).forEach(e => dots.push('<span class="w-1 h-1 rounded-full inline-block" style="background:' + e.color + '"></span>'));

    html += '<div onclick="showDayDetails(' + day + ',' + year + ',' + month + ')" ' +
      'class="py-1.5 rounded-xl text-center cursor-pointer text-xs flex flex-col items-center gap-0.5 hover:bg-zinc-800/60 transition ' +
      (isToday ? 'ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-semibold' : (hasTx||hasSched||hasEvents ? 'text-white' : 'text-zinc-500')) + '">' +
      day +
      (dots.length ? '<div class="flex gap-0.5 justify-center">' + dots.join("") + '</div>' : '<div class="h-2"></div>') +
      '</div>';
  }
  calendarGrid.innerHTML = html;
}

window.showDayDetails = (day, year, month) => {
  selectedCalDay = { day, year, month };
  const pad = n => String(n).padStart(2,"0");
  const dateKey = year+"-"+pad(month+1)+"-"+pad(day);

  const txs = allHistory.filter(tx => {
    const d = new Date(tx.created_at);
    return d.getFullYear()===year && d.getMonth()===month && d.getDate()===day;
  });
  const scheds = allScheduled.filter(p => {
    const d = new Date(p.scheduled_at);
    return d.getFullYear()===year && d.getMonth()===month && d.getDate()===day;
  });
  const events = allCalendarEvents.filter(e => e.date === dateKey);

  selectedDateEl.textContent = new Date(year,month,day).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});

  const total = txs.reduce((s,tx) => s+parseFloat(tx.amount), 0);
  dayTotalEl.textContent = txs.length ? total.toFixed(2) + " USDC" : "";

  let html = "";

  if (events.length) {
    html += events.map(e =>
      '<div class="flex items-center justify-between p-2.5 rounded-xl text-xs mb-1" style="background:' + e.color + '15;border:1px solid ' + e.color + '30">' +
      '<span>' + (typeIcons[e.type]||"📝") + ' ' + e.title + '</span>' +
      '<button onclick="deleteCalEvent(' + e.id + ')" class="text-zinc-600 hover:text-red-400 transition ml-2">✕</button>' +
      '</div>'
    ).join("");
  }

  if (scheds.length) {
    html += scheds.map(p =>
      '<div class="flex items-center justify-between p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs mb-1">' +
      '<span class="text-violet-300">💸 ' + (getContactName(p.recipient)||p.recipient.slice(0,8)+"...") + ' — ' + p.amount + ' USDC</span>' +
      '</div>'
    ).join("");
  }

  if (txs.length) {
    html += txs.map(tx =>
      '<div class="flex justify-between items-center p-2.5 bg-zinc-800/60 rounded-xl text-xs mb-1">' +
      '<span class="text-zinc-300">' + (getContactName(tx.recipient)||tx.recipient.slice(0,8)+"...") + '</span>' +
      '<span class="text-emerald-400 font-semibold">' + tx.amount + ' USDC</span></div>'
    ).join("");
  }

  if (!html) html = '<p class="text-zinc-600 text-xs text-center py-2">Nothing here yet</p>';
  dayTransactionsEl.innerHTML = html;
  dayDetails.classList.remove("hidden");
};