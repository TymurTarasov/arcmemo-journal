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

const connectBtn = document.getElementById('connectBtn')
const sendBtn = document.getElementById('sendBtn')
const walletStatus = document.getElementById('walletStatus')
const historyList = document.getElementById('historyList')

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

// Добавляем кнопку Export CSV
addExportButton()

loadHistoryFromStorage()
initWalletConnection()

// ==================== ФУНКЦИИ ====================

function addExportButton() {
  const clearBtn = document.getElementById('clearHistoryBtn')
  if (!clearBtn) return

  const exportBtn = document.createElement('button')
  exportBtn.textContent = 'Export CSV'
  exportBtn.className = 'text-sm px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 ml-2'
  exportBtn.onclick = exportToCSV

  clearBtn.parentNode.insertBefore(exportBtn, clearBtn.nextSibling)
}

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

// ==================== КАТЕГОРИИ + ГРУППИРОВКА ====================

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

function groupTransactionsByDate(transactions) {
  const groups = {}

  transactions.forEach(tx => {
    const dateKey = new Date(tx.timestamp).toISOString().split('T')[0]

    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        total: 0,
        transactions: []
      }
    }

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

  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  })
}

function getCategoryColor(category) {
  const colors = {
    'Payment': 'bg-blue-600',
    'Gift': 'bg-pink-600',
    'Work': 'bg-purple-600',
    'Test': 'bg-yellow-600',
    'Other': 'bg-zinc-600'
  }
  return colors[category] || 'bg-zinc-600'
}

function renderHistory() {
  historyList.innerHTML = ''

  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-3xl">
        Your payment history will appear here
      </div>
    `
    return
  }

  const grouped = groupTransactionsByDate(history)

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

// ==================== ЭКСПОРТ В CSV ====================

function exportToCSV() {
  if (history.length === 0) {
    alert('No transactions to export')
    return
  }

  const headers = ['Date', 'Amount (USDC)', 'Recipient', 'Category', 'Memo', 'Tx Hash']
  
  const rows = history.map(tx => {
    const date = new Date(tx.timestamp).toLocaleDateString()
    return [
      date,
      tx.amount,
      tx.recipient,
      tx.category,
      tx.memo.replace(/"/g, '""'),
      tx.txHash
    ]
  })

  let csvContent = headers.join(',') + '\n'
  
  rows.forEach(row => {
    csvContent += row.map(field => `"${field}"`).join(',') + '\n'
  })

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `arcmemo_history_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ==================== ИСТОРИЯ ====================

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