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

loadHistoryFromStorage()
initWalletConnection()

// ==================== ФУНКЦИИ ====================

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

    addToHistory(recipient, amountStr, memoText, hash)
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

// ==================== ГРУППИРОВКА ПО ДАТАМ ====================

function groupTransactionsByDate(transactions) {
  const groups = {}

  transactions.forEach(tx => {
    const date = new Date(tx.timestamp)
    const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD

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

  // Сортируем даты от новых к старым
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
      txDiv.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <div class="font-mono text-emerald-400 text-lg">${tx.amount} USDC</div>
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

// ==================== ИСТОРИЯ (хранение) ====================

function addToHistory(recipient, amount, memo, txHash) {
  const tx = {
    recipient,
    amount,
    memo: memo || '',
    txHash,
    timestamp: new Date().toISOString()
  }
  history.unshift(tx)
  renderHistory()
}

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