import './style.css'
import { createWalletClient, custom, parseUnits, formatUnits, createPublicClient, http } from 'viem'

const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
}

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
]

let walletClient = null
let account = null
let history = []
let contacts = []

const connectBtn = document.getElementById('connectBtn')
const sendBtn = document.getElementById('sendBtn')
const walletStatus = document.getElementById('walletStatus')
const historyList = document.getElementById('historyList')
const searchInput = document.getElementById('searchInput')
const calendarBtn = document.getElementById('calendarBtn')
const calendarModal = document.getElementById('calendarModal')
const calendarGrid = document.getElementById('calendarGrid')
const calendarTitle = document.getElementById('calendarTitle')
const dayDetails = document.getElementById('dayDetails')
const selectedDateEl = document.getElementById('selectedDate')
const dayTotalEl = document.getElementById('dayTotal')
const dayTransactionsEl = document.getElementById('dayTransactions')

let balanceEl = document.getElementById('balance')
if (!balanceEl) {
  balanceEl = document.createElement('div')
  balanceEl.id = 'balance'
  balanceEl.className = 'text-sm text-zinc-400 mt-1'
  walletStatus.parentNode.insertBefore(balanceEl, walletStatus.nextSibling)
}

const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: http('https://rpc.testnet.arc.network')
})

connectBtn.addEventListener('click', () => connectWallet(false))
sendBtn.addEventListener('click', sendWithMemo)
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory)
document.getElementById('exportBtn').addEventListener('click', exportToCSV)
calendarBtn.addEventListener('click', showCalendar)
document.getElementById('closeCalendar').addEventListener('click', () => calendarModal.classList.add('hidden'))
document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1))
document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1))
searchInput.addEventListener('input', renderHistory)
document.getElementById('addContactBtn').addEventListener('click', addContact)
document.getElementById('chooseContactBtn').addEventListener('click', showContactSelector)

loadHistoryFromStorage()
loadContactsFromStorage()
initWalletConnection()

// ==================== WALLET ====================

function initWalletConnection() {
  const wasConnected = localStorage.getItem('walletConnected') === 'true'
  if (!wasConnected || !window.ethereum) return

  window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
    if (accounts.length > 0) {
      connectWallet(true)
    } else {
      localStorage.setItem('walletConnected', 'false')
    }
  }).catch(() => {})
}

async function connectWallet(silent = false) {
  if (!window.ethereum) {
    alert('Please install MetaMask!')
    return
  }

  try {
    walletClient = createWalletClient({
      chain: ARC_TESTNET,
      transport: custom(window.ethereum)
    })

    const [address] = await walletClient.requestAddresses()
    account = address

    localStorage.setItem('walletConnected', 'true')

    walletStatus.innerHTML = `
      Connected: <span class="font-mono text-emerald-400">${address.slice(0,6)}...${address.slice(-4)}</span>
      <button id="disconnectBtn" class="ml-3 text-xs px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded-lg">Disconnect</button>
    `

    document.getElementById('disconnectBtn').onclick = disconnectWallet
    connectBtn.style.display = 'none'

    await updateBalance()
    await checkNetwork()

  } catch (error) {
    if (!silent) alert('Failed to connect wallet')
    localStorage.setItem('walletConnected', 'false')
  }
}

function disconnectWallet() {
  account = null
  walletClient = null
  localStorage.setItem('walletConnected', 'false')

  walletStatus.innerHTML = 'Wallet not connected'
  balanceEl.innerHTML = ''
  connectBtn.style.display = 'block'
}

async function updateBalance() {
  if (!account) return

  try {
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account]
    })

    const formatted = formatUnits(balance, 6)
    balanceEl.innerHTML = `Balance: <span class="text-emerald-400 font-medium">${formatted} USDC</span>`
  } catch (error) {
    balanceEl.innerHTML = `Balance: <span class="text-red-400">Error</span>`
  }
}

async function checkNetwork() {
  if (!walletClient) return

  try {
    const chainId = await walletClient.getChainId()
    const oldWarning = document.getElementById('network-warning')
    if (oldWarning) oldWarning.remove()

    if (chainId !== ARC_TESTNET.id) {
      const warning = document.createElement('div')
      warning.id = 'network-warning'
      warning.className = 'mt-2'
      warning.innerHTML = `
        <span class="text-red-400 text-sm">Wrong network!</span>
        <button id="switchNetworkBtn" class="ml-2 text-xs px-3 py-1 bg-orange-500 text-black rounded-lg font-medium">
          Switch to Arc Testnet
        </button>
      `
      walletStatus.appendChild(warning)

      document.getElementById('switchNetworkBtn').onclick = async () => {
        try {
          await walletClient.switchChain({ id: ARC_TESTNET.id })
          warning.remove()
          await updateBalance()
        } catch {
          alert('Please add Arc Testnet manually in MetaMask (Chain ID: 5042002)')
        }
      }
    }
  } catch (error) {}
}

// ==================== SEND ====================

async function sendWithMemo() {
  if (!account || !walletClient) {
    alert('Please connect wallet first')
    return
  }

  const recipient = document.getElementById('recipient').value.trim()
  const amountStr = document.getElementById('amount').value
  const memoText = document.getElementById('memo').value.trim()
  const category = document.getElementById('category').value

  if (!recipient || !amountStr) {
    alert('Please fill recipient and amount')
    return
  }

  try {
    sendBtn.disabled = true
    sendBtn.textContent = 'Sending...'

    const amountInWei = parseUnits(amountStr, 6)

    const hash = await walletClient.writeContract({
      account,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amountInWei]
    })

    addToHistory(recipient, amountStr, memoText, category, hash)
    saveHistoryToStorage()
    await updateBalance()

    alert(`Transaction sent!\nHash: ${hash}`)

  } catch (error) {
    console.error(error)
    alert('Transaction failed.')
  } finally {
    sendBtn.disabled = false
    sendBtn.textContent = 'Send with Memo'
  }
}

// ==================== CONTACTS ====================

function loadContactsFromStorage() {
  const saved = localStorage.getItem('arcmemo_contacts')
  if (saved) contacts = JSON.parse(saved)
  renderContacts()
}

function saveContactsToStorage() {
  localStorage.setItem('arcmemo_contacts', JSON.stringify(contacts))
}

function addContact() {
  const name = document.getElementById('contactName').value.trim()
  const address = document.getElementById('contactAddress').value.trim()

  if (!name || !address) {
    alert('Please enter both name and address')
    return
  }

  contacts.push({ id: Date.now(), name, address })
  saveContactsToStorage()
  renderContacts()

  document.getElementById('contactName').value = ''
  document.getElementById('contactAddress').value = ''
}

function deleteContact(id) {
  contacts = contacts.filter(c => c.id !== id)
  saveContactsToStorage()
  renderContacts()
}

function renderContacts() {
  const container = document.getElementById('contactsList')
  container.innerHTML = ''

  if (contacts.length === 0) {
    container.innerHTML = `<div class="text-zinc-500 text-sm">No contacts yet</div>`
    return
  }

  contacts.forEach(contact => {
    const div = document.createElement('div')
    div.className = 'flex justify-between items-center bg-zinc-800 rounded-2xl px-4 py-3'
    div.innerHTML = `
      <div>
        <div class="font-medium">${contact.name}</div>
        <div class="text-xs text-zinc-500 font-mono">${contact.address.slice(0, 10)}...${contact.address.slice(-6)}</div>
      </div>
      <button class="text-red-400 hover:text-red-500 text-sm px-3">Delete</button>
    `

    div.querySelector('button').onclick = () => deleteContact(contact.id)
    container.appendChild(div)
  })
}

function showContactSelector() {
  if (contacts.length === 0) {
    alert('You have no contacts yet. Add some first.')
    return
  }

  const recipientInput = document.getElementById('recipient')
  
  let html = 'Choose contact:\n\n'
  contacts.forEach((c, index) => {
    html += `${index + 1}. ${c.name} - ${c.address}\n`
  })

  const choice = prompt(html + '\nEnter number:')
  const index = parseInt(choice) - 1

  if (contacts[index]) {
    recipientInput.value = contacts[index].address
  }
}

// ==================== SEARCH + HISTORY ====================

function addToHistory(recipient, amount, memo, category, txHash) {
  const tx = {
    recipient,
    amount,
    memo: memo || '',
    category: category || 'Other',
    txHash,
    timestamp: new Date().toISOString()
  }
  history.unshift(tx)
  renderHistory()
}

function renderHistory(filteredHistory = null) {
  const list = filteredHistory || history
  historyList.innerHTML = ''

  if (list.length === 0) {
    historyList.innerHTML = `
      <div class="text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-3xl">
        No transactions found
      </div>
    `
    return
  }

  const grouped = groupTransactionsByDate(list)

  grouped.forEach(group => {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'mb-6'

    const header = document.createElement('div')
    header.className = 'flex justify-between items-center px-1 mb-2'
    header.innerHTML = `
      <div class="font-semibold text-lg">${formatDate(group.date)}</div>
      <div class="font-mono text-emerald-400 font-medium">${group.total.toFixed(2)} USDC</div>
    `

    const transactionsContainer = document.createElement('div')
    transactionsContainer.className = 'space-y-3'

    group.transactions.forEach(tx => {
      const txDiv = document.createElement('div')
      txDiv.className = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-4'
      const categoryColor = getCategoryColor(tx.category)
      
      txDiv.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-mono text-emerald-400 text-lg">${tx.amount} USDC</span>
              <span class="text-xs px-2 py-0.5 rounded-full ${categoryColor} text-white">${tx.category}</span>
            </div>
            <div class="text-xs text-zinc-500 mt-1">To: ${tx.recipient.slice(0,8)}...${tx.recipient.slice(-6)}</div>
            ${tx.memo ? `<div class="text-sm mt-2 text-zinc-300">"${tx.memo}"</div>` : ''}
          </div>
          <a href="https://testnet.arcscan.app/tx/${tx.txHash}" target="_blank" 
             class="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition">View</a>
        </div>
      `
      transactionsContainer.appendChild(txDiv)
    })

    groupDiv.appendChild(header)
    groupDiv.appendChild(transactionsContainer)
    historyList.appendChild(groupDiv)
  })
}

function groupTransactionsByDate(transactions) {
  const groups = {}
  transactions.forEach(tx => {
    const dateKey = new Date(tx.timestamp).toISOString().split('T')[0]
    if (!groups[dateKey]) groups[dateKey] = { date: dateKey, total: 0, transactions: [] }
    groups[dateKey].total += parseFloat(tx.amount)
    groups[dateKey].transactions.push(tx)
  })
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getCategoryColor(category) {
  const colors = {
    'Payment': 'bg-blue-600', 'Gift': 'bg-pink-600', 'Work': 'bg-purple-600',
    'Test': 'bg-yellow-600', 'Other': 'bg-zinc-600'
  }
  return colors[category] || 'bg-zinc-600'
}

// ==================== SEARCH ====================

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim()
  if (!query) {
    renderHistory()
    return
  }

  const filtered = history.filter(tx =>
    tx.recipient.toLowerCase().includes(query) ||
    tx.memo.toLowerCase().includes(query) ||
    tx.category.toLowerCase().includes(query)
  )
  renderHistory(filtered)
})

// ==================== CALENDAR ====================

function showCalendar() {
  calendarModal.classList.remove('hidden')
  renderCalendar(new Date())
}

function changeMonth(delta) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta)
  renderCalendar(currentCalendarDate)
}

let currentCalendarDate = new Date()

function renderCalendar(date) {
  calendarGrid.innerHTML = ''
  dayDetails.classList.add('hidden')

  const year = date.getFullYear()
  const month = date.getMonth()
  calendarTitle.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  weekdays.forEach(day => {
    const el = document.createElement('div')
    el.className = 'text-zinc-500 text-xs py-1'
    el.textContent = day
    calendarGrid.appendChild(el)
  })

  for (let i = 0; i < firstDay; i++) {
    calendarGrid.appendChild(document.createElement('div'))
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div')
    dayEl.className = 'py-2 text-center rounded-xl cursor-pointer hover:bg-zinc-800 text-sm'

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayTxs = history.filter(tx => new Date(tx.timestamp).toISOString().split('T')[0] === dateStr)

    if (dayTxs.length > 0) {
      dayEl.classList.add('bg-emerald-900/30', 'font-medium', 'text-emerald-400')
    }

    dayEl.textContent = day
    dayEl.onclick = () => showDayInCalendar(dateStr, dayTxs)
    calendarGrid.appendChild(dayEl)
  }
}

function showDayInCalendar(dateStr, transactions) {
  dayDetails.classList.remove('hidden')
  selectedDateEl.textContent = new Date(dateStr).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric' 
  })

  const total = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
  dayTotalEl.textContent = `${total.toFixed(2)} USDC`

  dayTransactionsEl.innerHTML = transactions.length === 0 
    ? `<div class="text-zinc-500 text-sm">No transactions</div>` 
    : ''

  transactions.forEach(tx => {
    const div = document.createElement('div')
    div.className = 'bg-zinc-800 rounded-xl p-3 text-sm'
    const categoryColor = getCategoryColor(tx.category)
    div.innerHTML = `
      <div class="flex justify-between">
        <div>
          <span class="font-mono text-emerald-400">${tx.amount} USDC</span>
          <span class="ml-2 text-xs px-2 py-0.5 rounded-full ${categoryColor} text-white">${tx.category}</span>
        </div>
        <a href="https://testnet.arcscan.app/tx/${tx.txHash}" target="_blank" class="text-xs text-zinc-400">View</a>
      </div>
      ${tx.memo ? `<div class="text-zinc-400 text-xs mt-1">"${tx.memo}"</div>` : ''}
    `
    dayTransactionsEl.appendChild(div)
  })
}

// ==================== EXPORT CSV ====================

function exportToCSV() {
  if (history.length === 0) {
    alert('No transactions to export')
    return
  }

  let csv = 'Date,Amount,Recipient,Category,Memo,Tx Hash\n'
  history.forEach(tx => {
    const date = new Date(tx.timestamp).toLocaleDateString()
    csv += `"${date}","${tx.amount}","${tx.recipient}","${tx.category}","${tx.memo}","${tx.txHash}"\n`
  })

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `arcmemo_history_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

// ==================== STORAGE ====================

function saveHistoryToStorage() {
  localStorage.setItem('arcmemo_history', JSON.stringify(history))
}

function loadHistoryFromStorage() {
  const saved = localStorage.getItem('arcmemo_history')
  if (saved) {
    history = JSON.parse(saved)
    renderHistory()
  }
}

function clearHistory() {
  if (!confirm('Clear all history?')) return
  history = []
  localStorage.removeItem('arcmemo_history')
  renderHistory()
}