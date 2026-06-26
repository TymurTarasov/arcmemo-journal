import './style.css'
import { createWalletClient, custom, parseUnits, getContract, formatUnits } from 'viem'

const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
}

const USDC_ADDRESS = '0x360000000000000000000000000000000000im0000'

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

let walletClient
let account
let history = []

const connectBtn = document.getElementById('connectBtn')
const sendBtn = document.getElementById('sendBtn')
const walletStatus = document.getElementById('walletStatus')
const historyList = document.getElementById('historyList')
const balanceEl = document.getElementById('balance') || createBalanceElement()

function createBalanceElement() {
  const div = document.createElement('div')
  div.id = 'balance'
  div.className = 'text-sm text-zinc-400 mt-1'
  walletStatus.parentNode.insertBefore(div, walletStatus.nextSibling)
  return div
}

connectBtn.addEventListener('click', connectWallet)
sendBtn.addEventListener('click', sendWithMemo)
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory)

loadHistoryFromStorage()
autoConnectWallet() // ← Автоподключение при загрузке

async function autoConnectWallet() {
  if (!window.ethereum) return

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' })
    if (accounts.length > 0) {
      await connectWallet(true) // true = тихое подключение
    }
  } catch (error) {
    console.log('Auto connect skipped')
  }
}

async function connectWallet(silent = false) {
  if (!window.ethereum) {
    alert('Please install MetaMask!')
    return
  }

  try {
    walletClient = createWalletClient({
      chain: ARC_TESTNET,
      transport: custom(window.ethereum),
    })

    const [address] = await walletClient.requestAddresses()
    account = address

    walletStatus.innerHTML = `
      Connected: <span class="font-mono text-emerald-400">${address.slice(0, 6)}...${address.slice(-4)}</span>
      <button id="disconnectBtn" class="ml-3 text-xs px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded-lg">Disconnect</button>
    `

    document.getElementById('disconnectBtn').onclick = disconnectWallet
    connectBtn.style.display = 'none'

    await updateBalance()
    await checkAndSwitchNetwork()
  } catch (error) {
    if (!silent) alert('Failed to connect wallet')
  }
}

function disconnectWallet() {
  account = null
  walletClient = null
  walletStatus.innerHTML = 'Wallet not connected'
  connectBtn.style.display = 'block'
  document.getElementById('balance').innerHTML = ''
}

async function updateBalance() {
  if (!account || !walletClient) return

  try {
    const balance = await walletClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account]
    })

    const formatted = formatUnits(balance, 6)
    document.getElementById('balance').innerHTML = `Balance: <span class="text-emerald-400 font-medium">${formatted} USDC</span>`
  } catch (error) {
    console.error('Failed to fetch balance')
  }
}

async function checkAndSwitchNetwork() { /* ... код из предыдущей версии ... */ }

async function switchToArcTestnet() { /* ... */ }

async function sendWithMemo() { /* ... код из предыдущей версии (оставляем как есть) ... */ }

// Дальше идут функции addToHistory, renderHistory, save/load/clearHistory — они остаются без изменений