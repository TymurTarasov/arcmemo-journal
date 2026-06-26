import './style.css'
import { createWalletClient, custom, parseUnits, getContract } from 'viem'

const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
}

// USDC ERC-20 адрес на Arc Testnet
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
  }
]

let walletClient
let account
let history = []

const connectBtn = document.getElementById('connectBtn')
const sendBtn = document.getElementById('sendBtn')
const walletStatus = document.getElementById('walletStatus')
const historyList = document.getElementById('historyList')

connectBtn.addEventListener('click', connectWallet)
sendBtn.addEventListener('click', sendWithMemo)
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory)

loadHistoryFromStorage()

async function connectWallet() {
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

    walletStatus.innerHTML = `Connected: <span class="font-mono text-emerald-400">${address.slice(0, 6)}...${address.slice(-4)}</span>`
    connectBtn.textContent = 'Wallet Connected'
    connectBtn.disabled = true

    await checkAndSwitchNetwork()
  } catch (error) {
    console.error(error)
    alert('Failed to connect wallet')
  }
}

async function checkAndSwitchNetwork() {
  const chainId = await walletClient.getChainId()
  if (chainId !== ARC_TESTNET.id) {
    walletStatus.innerHTML = `
      Connected: <span class="font-mono text-emerald-400">${account.slice(0,6)}...${account.slice(-4)}</span><br>
      <span class="text-red-400">Wrong network!</span>
    `
    const switchBtn = document.createElement('button')
    switchBtn.textContent = 'Switch to Arc Testnet'
    switchBtn.className = 'mt-2 px-4 py-2 bg-orange-500 text-black text-sm rounded-xl font-medium'
    switchBtn.onclick = switchToArcTestnet
    walletStatus.appendChild(switchBtn)
  }
}

async function switchToArcTestnet() {
  try {
    await walletClient.switchChain({ id: ARC_TESTNET.id })
    walletStatus.innerHTML = `Connected: <span class="font-mono text-emerald-400">${account.slice(0, 6)}...${account.slice(-4)}</span>`
  } catch (error) {
    alert('Please add Arc Testnet in MetaMask (Chain ID: 5042002)')
  }
}

async function sendWithMemo() {
  if (!account) {
    alert('Please connect wallet first')
    return
  }

  const currentChain = await walletClient.getChainId()
  if (currentChain !== ARC_TESTNET.id) {
    alert('Please switch to Arc Testnet first!')
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

    // Используем ERC-20 transfer с правильными 6 decimals
    const amountInWei = parseUnits(amountStr, 6)

    const hash = await walletClient.writeContract({
      account,
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amountInWei],
    })

    console.log('Transaction hash:', hash)

    addToHistory(recipient, amountStr, memoText, hash)
    saveHistoryToStorage()

    alert(`Transaction sent!\n\nHash: ${hash}`)

  } catch (error) {
    console.error('Transaction error:', error)
    alert('Transaction failed. Check console (F12).')
  } finally {
    sendBtn.disabled = false
    sendBtn.textContent = 'Send with Memo'
  }
}

function addToHistory(recipient, amount, memo, txHash) {
  const tx = { recipient, amount, memo, txHash, timestamp: new Date().toISOString() }
  history.unshift(tx)
  renderHistory()
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

  history.forEach(tx => {
    const div = document.createElement('div')
    div.className = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-4'
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <div class="font-mono text-emerald-400 text-lg">${tx.amount} USDC</div>
          <div class="text-xs text-zinc-500 mt-1">To: ${tx.recipient.slice(0, 8)}...${tx.recipient.slice(-6)}</div>
          ${tx.memo ? `<div class="text-sm mt-2 text-zinc-300">"${tx.memo}"</div>` : ''}
        </div>
        <a href="https://testnet.arcscan.app/tx/${tx.txHash}" target="_blank" 
           class="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition">View</a>
      </div>
    `
    historyList.appendChild(div)
  })
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
  history = []
  localStorage.removeItem('arcmemo_history')
  renderHistory()
}