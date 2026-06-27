import { supabase } from "./supabase.js";
import { createWalletClient, createPublicClient, custom, http, parseUnits, encodeFunctionData, formatUnits } from "viem";

const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
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

// ─── DOM ─────────────────────────────────────────────────────────────
const connectBtn      = document.getElementById("connectBtn");
const walletStatus    = document.getElementById("walletStatus");
const sendBtn         = document.getElementById("sendBtn");
const recipientInput  = document.getElementById("recipient");
const amountInput     = document.getElementById("amount");
const memoInput       = document.getElementById("memo");
const categoryInput   = document.getElementById("category");
const customCategory  = document.getElementById("customCategory");
const savedCategories = document.getElementById("savedCategories");
const historyList     = document.getElementById("historyList");
const contactsList    = document.getElementById("contactsList");
const contactName     = document.getElementById("contactName");
const contactAddress  = document.getElementById("contactAddress");
const addContactBtn   = document.getElementById("addContactBtn");
const chooseContactBtn= document.getElementById("chooseContactBtn");
const searchInput     = document.getElementById("searchInput");
const exportBtn       = document.getElementById("exportBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const calendarBtn     = document.getElementById("calendarBtn");
const calendarModal   = document.getElementById("calendarModal");
const closeCalendar   = document.getElementById("closeCalendar");
const prevMonth       = document.getElementById("prevMonth");
const nextMonth       = document.getElementById("nextMonth");
const calendarTitle   = document.getElementById("calendarTitle");
const calendarGrid    = document.getElementById("calendarGrid");
const dayDetails      = document.getElementById("dayDetails");
const selectedDateEl  = document.getElementById("selectedDate");
const dayTotalEl      = document.getElementById("dayTotal");
const dayTransactionsEl = document.getElementById("dayTransactions");

// ─── STATE ───────────────────────────────────────────────────────────
let account = null;
let allHistory = [];
let allContacts = [];
let customCategoriesList = [];
let currentCalDate = new Date();

// ─── TOAST ───────────────────────────────────────────────────────────
function showToast(message, type = "success") {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  const colors = {
    success: "bg-emerald-500 text-black",
    error: "bg-red-500 text-white",
    info: "bg-zinc-700 text-white",
  };
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = "fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-sm font-medium max-w-sm " + colors[type];
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.5s";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// ─── CUSTOM CATEGORIES ───────────────────────────────────────────────
function loadCustomCategories() {
  const stored = localStorage.getItem("arcmemo_categories");
  customCategoriesList = stored ? JSON.parse(stored) : [];
  renderSavedCategories();
}

function saveCustomCategory(name) {
  if (!name || customCategoriesList.includes(name)) return;
  customCategoriesList.push(name);
  localStorage.setItem("arcmemo_categories", JSON.stringify(customCategoriesList));
  renderSavedCategories();
}

function deleteCustomCategory(name) {
  customCategoriesList = customCategoriesList.filter(c => c !== name);
  localStorage.setItem("arcmemo_categories", JSON.stringify(customCategoriesList));
  renderSavedCategories();
}

function renderSavedCategories() {
  if (!customCategoriesList.length) {
    savedCategories.innerHTML = "";
    return;
  }
  savedCategories.innerHTML =
    '<span class="text-xs text-zinc-500 w-full mb-1">Saved categories — click to use:</span>' +
    customCategoriesList.map(cat =>
      '<div class="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs">' +
      '<button onclick="useSavedCategory(\'' + cat + '\')" class="text-zinc-300 hover:text-white transition">' + cat + '</button>' +
      '<button onclick="deleteCustomCategory(\'' + cat + '\')" class="text-zinc-600 hover:text-red-400 ml-1 transition">✕</button>' +
      '</div>'
    ).join("");
}

window.useSavedCategory = (name) => {
  categoryInput.value = "custom";
  customCategory.classList.remove("hidden");
  customCategory.value = name;
  showToast("Category selected: " + name, "info");
};

window.deleteCustomCategory = (name) => {
  deleteCustomCategory(name);
};

categoryInput.addEventListener("change", () => {
  if (categoryInput.value === "custom") {
    customCategory.classList.remove("hidden");
    customCategory.focus();
  } else {
    customCategory.classList.add("hidden");
    customCategory.value = "";
  }
});

customCategory.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && customCategory.value.trim()) {
    saveCustomCategory(customCategory.value.trim());
    showToast("Category saved: " + customCategory.value.trim(), "success");
  }
});

function getCategory() {
  if (categoryInput.value === "custom") {
    const val = customCategory.value.trim();
    if (val) saveCustomCategory(val);
    return val || "Other";
  }
  return categoryInput.value;
}

// ─── CONTACT MODAL ───────────────────────────────────────────────────
function createContactModal() {
  if (document.getElementById("contactModal")) return;
  const modal = document.createElement("div");
  modal.id = "contactModal";
  modal.className = "hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Choose a contact</h3>
        <button id="closeContactModal" class="text-zinc-400 hover:text-white text-xl">✕</button>
      </div>
      <input id="contactSearchModal" type="text" placeholder="Search by name or address..."
        class="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 text-sm mb-4">
      <div id="contactModalList" class="space-y-2 max-h-72 overflow-y-auto"></div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("closeContactModal").onclick = () => modal.classList.add("hidden");
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
  document.getElementById("contactSearchModal").addEventListener("input", (e) => {
    renderContactModalList(e.target.value);
  });
}

function renderContactModalList(query = "") {
  const list = document.getElementById("contactModalList");
  const q = query.toLowerCase();
  const filtered = allContacts.filter(c =>
    c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
  );
  if (!filtered.length) {
    list.innerHTML = '<p class="text-zinc-500 text-sm text-center py-4">No contacts found</p>';
    return;
  }
  list.innerHTML = filtered.map(c => {
    const initials = c.name.slice(0, 2).toUpperCase();
    return (
      '<div onclick="selectContactFromModal(\'' + c.address + '\',\'' + c.name + '\')" ' +
      'class="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl cursor-pointer transition">' +
      '<div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">' + initials + '</div>' +
      '<div class="flex-1 min-w-0">' +
      '<div class="font-medium text-sm">' + c.name + '</div>' +
      '<div class="font-mono text-xs text-zinc-400 truncate">' + c.address + '</div>' +
      '</div>' +
      '<div class="text-emerald-400 text-sm">→</div>' +
      '</div>'
    );
  }).join("");
}

window.selectContactFromModal = (address, name) => {
  recipientInput.value = address;
  document.getElementById("contactModal").classList.add("hidden");
  showToast("Selected: " + name, "info");
};

// ─── AUTO-CONNECT ─────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  createContactModal();
  loadCustomCategories();
  if (!window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      account = accounts[0];
      updateWalletUI();
      await switchToArc();
      await loadBalance();
      await loadHistory();
      await loadContacts();
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
    await loadBalance();
    await loadHistory();
    await loadContacts();
  } catch (err) { showToast("Connection error: " + err.message, "error"); }
};

function updateWalletUI() {
  walletStatus.innerHTML =
    '<span class="text-emerald-400 font-mono">' + account.slice(0,6) + "..." + account.slice(-4) + "</span>";
  connectBtn.textContent = "Disconnect";
  connectBtn.className = "px-6 py-3 bg-zinc-800 hover:bg-red-900/40 text-zinc-300 hover:text-red-400 font-medium rounded-2xl transition text-sm";
  connectBtn.onclick = disconnectWallet;
}

function disconnectWallet() {
  account = null;
  allHistory = [];
  allContacts = [];
  walletStatus.innerHTML = "";
  const balEl = document.getElementById("balanceDisplay");
  if (balEl) balEl.textContent = "";
  connectBtn.textContent = "Connect Wallet";
  connectBtn.className = "px-6 py-3 bg-white text-black font-medium rounded-2xl hover:bg-zinc-200 transition";
  connectBtn.onclick = async () => {
    if (!window.ethereum) { showToast("Please install MetaMask", "error"); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accounts[0];
      updateWalletUI();
      await switchToArc();
      await loadBalance();
      await loadHistory();
      await loadContacts();
    } catch (err) { showToast("Error: " + err.message, "error"); }
  };
  renderHistory([]);
  renderContacts([]);
  showToast("Wallet disconnected", "info");
}

// ─── BALANCE ─────────────────────────────────────────────────────────
async function loadBalance() {
  if (!account) return;
  try {
    const pub = createPublicClient({ chain: ARC_TESTNET, transport: http("https://rpc.testnet.arc.network") });
    const raw = await pub.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [account] });
    const bal = formatUnits(raw, 6);
    const balEl = document.getElementById("balanceDisplay");
    if (balEl) balEl.textContent = parseFloat(bal).toFixed(2) + " USDC";
  } catch (e) { console.error("Balance:", e); }
}

// ─── ARC SWITCH ──────────────────────────────────────────────────────
async function switchToArc() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x4CEF52" }] });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
        chainId: "0x4CEF52", chainName: "Arc Testnet",
        nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
        rpcUrls: ["https://rpc.testnet.arc.network"],
        blockExplorerUrls: ["https://testnet.arcscan.app"],
      }]});
    }
  }
}

// ─── SEND ────────────────────────────────────────────────────────────
sendBtn.onclick = async () => {
  if (!account) { showToast("Please connect your wallet first!", "error"); return; }
  const to = recipientInput.value.trim();
  const amount = amountInput.value;
  const memo = memoInput.value.trim();
  const category = getCategory();
  if (!to || !amount) { showToast("Please fill in recipient address and amount", "error"); return; }
  try {
    sendBtn.textContent = "⏳ Sending...";
    sendBtn.disabled = true;
    const wc = createWalletClient({ chain: ARC_TESTNET, transport: custom(window.ethereum) });
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to, parseUnits(amount, 6)] });
    const hash = await wc.sendTransaction({ account, to: USDC_ADDRESS, data });
    await saveTransaction(to, amount, memo, category, hash);
    await loadHistory();
    await loadBalance();
    const short = hash.slice(0,10) + "..." + hash.slice(-6);
    showToast(
      '✅ Sent ' + amount + ' USDC!<br>' +
      '<a href="https://testnet.arcscan.app/tx/' + hash + '" target="_blank" class="underline font-mono text-xs">' + short + ' ↗</a>',
      "success"
    );
    recipientInput.value = ""; memoInput.value = ""; amountInput.value = "1";
  } catch (err) {
    showToast("Transaction error: " + err.message, "error");
  } finally {
    sendBtn.textContent = "Send with Memo";
    sendBtn.disabled = false;
  }
};

async function saveTransaction(recipient, amount, memo, category, txhash) {
  const { error } = await supabase.from("transactions").insert({
    wallet: account.toLowerCase(), recipient, amount: parseFloat(amount), memo, category, txhash,
  });
  if (error) console.error("Supabase:", error);
}

// ─── HISTORY ─────────────────────────────────────────────────────────
async function loadHistory() {
  if (!account) return;
  const { data, error } = await supabase.from("transactions").select("*")
    .eq("wallet", account.toLowerCase()).order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  allHistory = data || [];
  renderHistory(allHistory);
}

function getContactName(address) {
  const c = allContacts.find(c => c.address.toLowerCase() === address.toLowerCase());
  return c ? c.name : null;
}

function renderHistory(items) {
  if (!items.length) {
    historyList.innerHTML = '<p class="text-zinc-500 text-sm py-4">No transactions yet</p>';
    return;
  }
  historyList.innerHTML = items.map(tx => {
    const name = getContactName(tx.recipient);
    const displayName = name
      ? '<span class="text-white font-medium">' + name + '</span> <span class="text-zinc-500 font-mono text-xs">' + tx.recipient.slice(0,6) + "..." + tx.recipient.slice(-4) + "</span>"
      : '<span class="font-mono text-zinc-300">' + tx.recipient.slice(0,8) + "..." + tx.recipient.slice(-6) + "</span>";
    return (
      '<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition">' +
      '<div class="flex justify-between items-start gap-4"><div class="flex-1">' +
      '<div class="text-xs text-zinc-500 mb-2">' + new Date(tx.created_at).toLocaleString("en") + "</div>" +
      '<div class="mb-1">' + displayName + "</div>" +
      (tx.memo ? '<div class="text-sm text-zinc-400 mt-2 bg-zinc-800 rounded-xl px-3 py-2">💬 ' + tx.memo + "</div>" : "") +
      '<div class="text-xs text-zinc-600 mt-2">📂 ' + tx.category + "</div>" +
      '</div><div class="text-right shrink-0">' +
      '<div class="text-emerald-400 font-semibold text-lg">' + tx.amount + " USDC</div>" +
      (tx.txhash ? '<a href="https://testnet.arcscan.app/tx/' + tx.txhash + '" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 underline">View tx ↗</a>' : "") +
      "</div></div></div>"
    );
  }).join("");
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  renderHistory(allHistory.filter(tx =>
    tx.recipient.toLowerCase().includes(q) ||
    (tx.memo && tx.memo.toLowerCase().includes(q)) ||
    tx.category.toLowerCase().includes(q) ||
    (getContactName(tx.recipient) && getContactName(tx.recipient).toLowerCase().includes(q))
  ));
});

exportBtn.onclick = () => {
  if (!allHistory.length) { showToast("No transactions to export", "info"); return; }
  const rows = [
    ["Date","Contact","Recipient","Amount","Memo","Category","TxHash"],
    ...allHistory.map(tx => [
      new Date(tx.created_at).toLocaleString("en"),
      getContactName(tx.recipient) || "",
      tx.recipient, tx.amount, tx.memo || "", tx.category, tx.txhash || "",
    ]),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "arcmemo.csv";
  a.click();
  showToast("CSV downloaded ✓", "success");
};

clearHistoryBtn.onclick = async () => {
  if (!account || !confirm("Delete all transaction history?")) return;
  await supabase.from("transactions").delete().eq("wallet", account.toLowerCase());
  allHistory = [];
  renderHistory([]);
  showToast("History cleared", "info");
};

// ─── CONTACTS ────────────────────────────────────────────────────────
addContactBtn.onclick = async () => {
  if (!account) { showToast("Please connect your wallet!", "error"); return; }
  const name = contactName.value.trim();
  const address = contactAddress.value.trim();
  if (!name || !address) { showToast("Please fill in name and address", "error"); return; }
  const { error } = await supabase.from("contacts").insert({ wallet: account.toLowerCase(), name, address });
  if (error) { showToast("Error: " + error.message, "error"); return; }
  contactName.value = ""; contactAddress.value = "";
  await loadContacts();
  showToast("Contact added ✓", "success");
};

async function loadContacts() {
  if (!account) return;
  const { data, error } = await supabase.from("contacts").select("*")
    .eq("wallet", account.toLowerCase()).order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  allContacts = data || [];
  renderContacts(allContacts);
  renderHistory(allHistory);
}

function renderContacts(contacts) {
  if (!contacts.length) {
    contactsList.innerHTML = '<p class="text-zinc-500 text-sm py-2">No contacts yet — add your first one!</p>';
    return;
  }
  contactsList.innerHTML = contacts.map(c => {
    const initials = c.name.slice(0,2).toUpperCase();
    return (
      '<div class="flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-750 rounded-2xl border border-zinc-700 transition group">' +
      '<div class="flex items-center gap-3">' +
      '<div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">' + initials + '</div>' +
      '<div>' +
      '<div class="font-medium text-sm">' + c.name + '</div>' +
      '<div class="font-mono text-xs text-zinc-400 mt-0.5">' + c.address.slice(0,8) + "..." + c.address.slice(-6) + '</div>' +
      '</div></div>' +
      '<div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">' +
      '<button onclick="useContact(\'' + c.address + '\',\'' + c.name + '\')" class="text-xs px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 rounded-xl">Send →</button>' +
      '<button onclick="deleteContact(' + c.id + ')" class="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl">Delete</button>' +
      '</div></div>'
    );
  }).join("");
}

window.useContact = (address, name) => {
  recipientInput.value = address;
  showToast("Selected: " + name, "info");
  recipientInput.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.deleteContact = async (id) => {
  await supabase.from("contacts").delete().eq("id", id);
  await loadContacts();
  showToast("Contact deleted", "info");
};

chooseContactBtn.onclick = () => {
  if (!account) { showToast("Please connect your wallet!", "error"); return; }
  if (!allContacts.length) { showToast("No contacts yet — add your first one!", "info"); return; }
  const modal = document.getElementById("contactModal");
  document.getElementById("contactSearchModal").value = "";
  renderContactModalList("");
  modal.classList.remove("hidden");
};

// ─── CALENDAR ────────────────────────────────────────────────────────
calendarBtn.onclick = () => { calendarModal.classList.remove("hidden"); renderCalendar(); };
closeCalendar.onclick = () => calendarModal.classList.add("hidden");
prevMonth.onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderCalendar(); };
nextMonth.onclick = () => { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderCalendar(); };

function renderCalendar() {
  const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth();
  calendarTitle.textContent = new Date(year,month).toLocaleString("en-US",{month:"long",year:"numeric"});
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const txByDay = {};
  allHistory.forEach(tx => {
    const d = new Date(tx.created_at);
    if (d.getFullYear()===year && d.getMonth()===month) {
      const day = d.getDate();
      if (!txByDay[day]) txByDay[day]=[];
      txByDay[day].push(tx);
    }
  });
  const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  let html = dayNames.map(d=>'<div class="text-zinc-500 text-xs font-medium py-1">'+d+"</div>").join("");
  for(let i=0;i<firstDay;i++) html+="<div></div>";
  for(let day=1;day<=daysInMonth;day++){
    const hasTx=txByDay[day];
    html+='<div onclick="showDayDetails('+day+','+year+','+month+')" class="py-1 rounded-lg text-center cursor-pointer text-sm '+(hasTx?"bg-emerald-500/20 text-emerald-400 font-semibold hover:bg-emerald-500/40":"hover:bg-zinc-800 text-zinc-400")+'">'+day+"</div>";
  }
  calendarGrid.innerHTML=html;
  dayDetails.classList.add("hidden");
}

window.showDayDetails=(day,year,month)=>{
  const txs=allHistory.filter(tx=>{const d=new Date(tx.created_at);return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day;});
  if(!txs.length){dayDetails.classList.add("hidden");return;}
  const total=txs.reduce((s,tx)=>s+parseFloat(tx.amount),0);
  selectedDateEl.textContent=new Date(year,month,day).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  dayTotalEl.textContent=total.toFixed(2)+" USDC";
  dayTransactionsEl.innerHTML=txs.map(tx=>{
    const name=getContactName(tx.recipient);
    return '<div class="p-3 bg-zinc-800 rounded-xl text-xs"><div class="flex justify-between mb-1"><span class="text-zinc-300">'+(name||tx.recipient.slice(0,8)+"...")+'</span><span class="text-emerald-400 font-semibold">'+tx.amount+' USDC</span></div>'+(tx.memo?'<div class="text-zinc-500">💬 '+tx.memo+"</div>":"")+"</div>";
  }).join("");
  dayDetails.classList.remove("hidden");
};