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
    inputs: [{ name: "to", type: "address" },{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const $ = id => document.getElementById(id);
const connectBtn      = $("connectBtn");
const walletStatus    = $("walletStatus");
const sendBtn         = $("sendBtn");
const recipientInput  = $("recipient");
const amountInput     = $("amount");
const memoInput       = $("memo");
const categoryInput   = $("category");
const historyList     = $("historyList");
const contactsList    = $("contactsList");
const contactName     = $("contactName");
const contactAddress  = $("contactAddress");
const addContactBtn   = $("addContactBtn");
const chooseContactBtn= $("chooseContactBtn");
const searchInput     = $("searchInput");
const exportBtn       = $("exportBtn");
const clearHistoryBtn = $("clearHistoryBtn");
const calendarBtn     = $("calendarBtn");
const calendarModal   = $("calendarModal");
const closeCalendar   = $("closeCalendar");
const prevMonth       = $("prevMonth");
const nextMonth       = $("nextMonth");
const calendarTitle   = $("calendarTitle");
const calendarGrid    = $("calendarGrid");
const dayDetails      = $("dayDetails");
const selectedDateEl  = $("selectedDate");
const dayTotalEl      = $("dayTotal");
const dayTransactionsEl = $("dayTransactions");
const savedCategoriesBar  = $("savedCategoriesBar");
const savedCategoriesList = $("savedCategoriesList");
const newCategoryInput    = $("newCategoryInput");
const addCategoryBtn      = $("addCategoryBtn");

let account = null;
let allHistory = [];
let allContacts = [];
let allCategories = [];
let currentCalDate = new Date();

// ─── TOAST ───────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  const old = $("toast"); if (old) old.remove();
  const colors = { success: "bg-emerald-500 text-black", error: "bg-red-500 text-white", info: "bg-zinc-800 text-zinc-200 border border-zinc-700" };
  const t = document.createElement("div");
  t.id = "toast";
  t.className = "fixed top-5 right-5 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium max-w-xs " + colors[type];
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition="opacity 0.4s"; t.style.opacity="0"; setTimeout(()=>t.remove(),400); }, 3500);
}

// ─── CATEGORIES ──────────────────────────────────────────────────────
async function loadCategories() {
  if (!account) return;
  const { data } = await supabase.from("categories").select("*")
    .eq("wallet", account.toLowerCase()).order("created_at", { ascending: true });
  allCategories = data || [];
  rebuildCategorySelect();
  renderSavedCategories();
  savedCategoriesBar.classList.remove("hidden");
}

function rebuildCategorySelect() {
  const defaults = ["Payment","Gift","Work","Other"];
  const current = categoryInput.value;
  categoryInput.innerHTML = "";
  [...defaults, ...allCategories.map(c=>c.name)].forEach(name => {
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
    '<div class="flex items-center gap-1 bg-zinc-800 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 group">' +
    '<button onclick="selectCategory(\'' + c.name + '\')" class="text-xs text-zinc-300 hover:text-white transition">' + c.name + '</button>' +
    '<button onclick="renameCategory(' + c.id + ',\'' + c.name + '\')" class="text-zinc-600 hover:text-blue-400 text-xs ml-1 transition" title="Rename">✎</button>' +
    '<button onclick="deleteCategoryById(' + c.id + ')" class="text-zinc-600 hover:text-red-400 text-xs ml-0.5 transition" title="Delete">✕</button>' +
    '</div>'
  ).join("");
}

window.selectCategory = (name) => {
  categoryInput.value = name;
  showToast("Category: " + name, "info");
};

window.renameCategory = async (id, oldName) => {
  const newName = prompt("Rename category \"" + oldName + '":', oldName);
  if (!newName || newName.trim() === oldName) return;
  const { error } = await supabase.from("categories").update({ name: newName.trim() }).eq("id", id);
  if (error) { showToast("Error: " + error.message, "error"); return; }
  await loadCategories();
  showToast("Renamed to: " + newName.trim(), "success");
};

window.deleteCategoryById = async (id) => {
  if (!confirm("Delete this category?")) return;
  await supabase.from("categories").delete().eq("id", id);
  await loadCategories();
  showToast("Category deleted", "info");
};

addCategoryBtn.onclick = async () => {
  const name = newCategoryInput.value.trim();
  if (!name) { showToast("Enter a category name", "error"); return; }
  if (!account) { showToast("Connect wallet first", "error"); return; }
  if (allCategories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    showToast("Category already exists", "info"); return;
  }
  const { error } = await supabase.from("categories").insert({ wallet: account.toLowerCase(), name });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  newCategoryInput.value = "";
  await loadCategories();
  showToast("Category saved: " + name, "success");
};

newCategoryInput.addEventListener("keydown", e => { if (e.key === "Enter") addCategoryBtn.click(); });

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
        <button id="closeContactModal" class="text-zinc-500 hover:text-white transition">✕</button>
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
    c.name.toLowerCase().includes(q.toLowerCase()) || c.address.toLowerCase().includes(q.toLowerCase())
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

// ─── AUTO-CONNECT ─────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  createContactModal();
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      account = accounts[0];
      updateWalletUI();
      await switchToArc();
      await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories()]);
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
    await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories()]);
  } catch (err) { showToast("Connection error: " + err.message, "error"); }
};

function updateWalletUI() {
  walletStatus.innerHTML = '<span class="text-emerald-400 font-mono text-xs">' + account.slice(0,6) + "..." + account.slice(-4) + "</span>";
  connectBtn.textContent = "Disconnect";
  connectBtn.className = "px-5 py-2.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 text-sm font-medium rounded-2xl transition border border-zinc-700";
  connectBtn.onclick = disconnectWallet;
}

function disconnectWallet() {
  account = null; allHistory = []; allContacts = []; allCategories = [];
  walletStatus.innerHTML = "";
  $("balanceDisplay").textContent = "";
  savedCategoriesBar.classList.add("hidden");
  connectBtn.textContent = "Connect Wallet";
  connectBtn.className = "px-5 py-2.5 bg-white text-black text-sm font-medium rounded-2xl hover:bg-zinc-100 transition";
  connectBtn.onclick = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accounts[0]; updateWalletUI(); await switchToArc();
      await Promise.all([loadBalance(), loadHistory(), loadContacts(), loadCategories()]);
    } catch (err) { showToast("Error: " + err.message, "error"); }
  };
  renderHistory([]); renderContacts([]);
  updateStats();
  showToast("Wallet disconnected", "info");
}

// ─── BALANCE ─────────────────────────────────────────────────────────
async function loadBalance() {
  if (!account) return;
  try {
    const pub = createPublicClient({ chain: ARC_TESTNET, transport: http("https://rpc.testnet.arc.network") });
    const raw = await pub.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [account] });
    const bal = parseFloat(formatUnits(raw, 6)).toFixed(2);
    $("balanceDisplay").textContent = bal + " USDC";
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
    await supabase.from("transactions").insert({ wallet: account.toLowerCase(), recipient: to, amount: parseFloat(amount), memo, category, txhash: hash });
    await Promise.all([loadHistory(), loadBalance()]);
    const short = hash.slice(0,8) + "..." + hash.slice(-6);
    showToast('✅ Sent ' + amount + ' USDC!<br><a href="https://testnet.arcscan.app/tx/'+hash+'" target="_blank" class="underline opacity-80">'+short+' ↗</a>', "success");
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
  updateStats();
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
    return (
      '<div class="flex items-start gap-3 p-3.5 bg-zinc-800/40 hover:bg-zinc-800/70 rounded-2xl border border-zinc-800/60 hover:border-zinc-700/60 transition group">' +
      '<div class="w-9 h-9 rounded-full bg-zinc-700/60 flex items-center justify-center text-xs font-semibold text-zinc-400 shrink-0 mt-0.5">' + avatar + '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="flex items-start justify-between gap-2">' +
      '<div>' +
      (name ? '<div class="text-sm font-medium text-white">' + name + '</div>' : '') +
      '<div class="font-mono text-xs text-zinc-500">' + tx.recipient.slice(0,8) + "..." + tx.recipient.slice(-6) + '</div>' +
      '</div>' +
      '<div class="text-right shrink-0">' +
      '<div class="text-sm font-semibold text-emerald-400">+' + tx.amount + ' USDC</div>' +
      (tx.txhash ? '<a href="https://testnet.arcscan.app/tx/'+tx.txhash+'" target="_blank" class="text-xs text-zinc-600 hover:text-blue-400 transition">tx ↗</a>' : '') +
      '</div></div>' +
      (tx.memo ? '<div class="text-xs text-zinc-500 mt-1.5 bg-zinc-900/60 rounded-xl px-2.5 py-1.5">💬 ' + tx.memo + '</div>' : '') +
      '<div class="flex items-center gap-2 mt-1.5">' +
      '<span class="text-xs text-zinc-600">' + new Date(tx.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) + '</span>' +
      '<span class="w-1 h-1 bg-zinc-700 rounded-full"></span>' +
      '<span class="text-xs text-zinc-600">📂 ' + tx.category + '</span>' +
      '</div></div></div>'
    );
  }).join("");
}

function updateStats() {
  const total = allHistory.reduce((s,tx) => s + parseFloat(tx.amount), 0);
  $("statTotal").textContent = allHistory.length ? total.toFixed(2) + " USDC" : "—";
  $("statCount").textContent = allHistory.length || "—";
  $("statContacts").textContent = allContacts.length || "—";
  $("statLast").textContent = allHistory.length
    ? new Date(allHistory[0].created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})
    : "—";
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
    ...allHistory.map(tx=>[new Date(tx.created_at).toLocaleString("en"),getContactName(tx.recipient)||"",tx.recipient,tx.amount,tx.memo||"",tx.category,tx.txhash||""])];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));
  a.download="arcmemo.csv"; a.click();
  showToast("CSV downloaded ✓", "success");
};

clearHistoryBtn.onclick = async () => {
  if (!account || !confirm("Delete all transaction history?")) return;
  await supabase.from("transactions").delete().eq("wallet", account.toLowerCase());
  allHistory = []; renderHistory([]); updateStats();
  showToast("History cleared", "info");
};

// ─── CONTACTS ────────────────────────────────────────────────────────
addContactBtn.onclick = async () => {
  if (!account) { showToast("Connect wallet first!", "error"); return; }
  const name = contactName.value.trim(), address = contactAddress.value.trim();
  if (!name || !address) { showToast("Fill in name and address", "error"); return; }
  const { error } = await supabase.from("contacts").insert({ wallet: account.toLowerCase(), name, address });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  contactName.value = ""; contactAddress.value = "";
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
  updateStats();
}

function renderContacts(contacts) {
  if (!contacts.length) {
    contactsList.innerHTML = '<p class="text-zinc-600 text-xs py-2">No contacts yet</p>';
    return;
  }
  contactsList.innerHTML = contacts.map(c => {
    const initials = c.name.slice(0,2).toUpperCase();
    return (
      '<div class="flex items-center justify-between py-2 px-1 group">' +
      '<div class="flex items-center gap-2.5">' +
      '<div class="w-8 h-8 rounded-full bg-zinc-700/60 text-zinc-400 flex items-center justify-center font-semibold text-xs">' + initials + '</div>' +
      '<div><div class="text-sm font-medium">' + c.name + '</div>' +
      '<div class="font-mono text-xs text-zinc-600">' + c.address.slice(0,6) + "..." + c.address.slice(-4) + '</div></div>' +
      '</div>' +
      '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">' +
      '<button onclick="useContact(\'' + c.address + '\',\'' + c.name + '\')" class="text-xs px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition">Send</button>' +
      '<button onclick="deleteContact(' + c.id + ')" class="text-xs px-2.5 py-1 bg-zinc-700/50 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition">✕</button>' +
      '</div></div>'
    );
  }).join("");
}

window.useContact = (address, name) => {
  recipientInput.value = address;
  showToast("Selected: " + name, "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteContact = async (id) => {
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

// ─── CALENDAR ────────────────────────────────────────────────────────
calendarBtn.onclick = () => { calendarModal.classList.remove("hidden"); renderCalendar(); };
closeCalendar.onclick = () => calendarModal.classList.add("hidden");
prevMonth.onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderCalendar(); };
nextMonth.onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderCalendar(); };

function renderCalendar() {
  const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
  calendarTitle.textContent = new Date(year,month).toLocaleString("en-US",{month:"long",year:"numeric"});
  const firstDay = new Date(year,month,1).getDay(), daysInMonth = new Date(year,month+1,0).getDate();
  const txByDay = {};
  allHistory.forEach(tx => {
    const d = new Date(tx.created_at);
    if (d.getFullYear()===year && d.getMonth()===month) { const day=d.getDate(); if(!txByDay[day]) txByDay[day]=[]; txByDay[day].push(tx); }
  });
  const dn = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  let html = dn.map(d=>'<div class="text-zinc-600 text-xs py-1">'+d+'</div>').join("");
  for(let i=0;i<firstDay;i++) html+="<div></div>";
  for(let day=1;day<=daysInMonth;day++){
    const h=txByDay[day];
    html+='<div onclick="showDayDetails('+day+','+year+','+month+')" class="py-1.5 rounded-xl text-center cursor-pointer text-xs '+(h?"bg-emerald-500/20 text-emerald-400 font-semibold":"hover:bg-zinc-800 text-zinc-500")+'">'+day+'</div>';
  }
  calendarGrid.innerHTML=html; dayDetails.classList.add("hidden");
}

window.showDayDetails=(day,year,month)=>{
  const txs=allHistory.filter(tx=>{const d=new Date(tx.created_at);return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day;});
  if(!txs.length){dayDetails.classList.add("hidden");return;}
  const total=txs.reduce((s,tx)=>s+parseFloat(tx.amount),0);
  selectedDateEl.textContent=new Date(year,month,day).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  dayTotalEl.textContent=total.toFixed(2)+" USDC";
  dayTransactionsEl.innerHTML=txs.map(tx=>{const name=getContactName(tx.recipient);return '<div class="flex justify-between items-center p-2.5 bg-zinc-800/60 rounded-xl text-xs"><span class="text-zinc-300">'+(name||tx.recipient.slice(0,8)+"...")+'</span><span class="text-emerald-400 font-semibold">'+tx.amount+' USDC</span></div>';}).join("");
  dayDetails.classList.remove("hidden");
};