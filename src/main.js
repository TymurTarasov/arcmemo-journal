import './style.css'
import { createWalletClient, custom, parseUnits } from 'viem'

const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
}

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

let walletClient
let account

const connectBtn = document.getElementById('connectBtn')
const sendBtn = document.getElementById('sendBtn')
const walletStatus = document.getElementById('walletStatus')

connectBtn.addEventListener('click', connectWallet)
sendBtn.addEventListener('click', sendWithMemo)

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

    // Check current chain
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
      <span class="text-red-400">Wrong network! Please switch to Arc Testnet.</span>
    `

    // Create switch button
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
    // Refresh status after switching
    walletStatus.innerHTML = `Connected: <span class="font-mono text-emerald-400">${account.slice(0, 6)}...${account.slice(-4)}</span>`
    alert('Successfully switched to Arc Testnet!')
  } catch (error) {
    console.error(error)
    alert('Failed to switch network. Please add Arc Testnet manually in MetaMask (Chain ID: 5042002)')
  }
}

async function sendWithMemo() {
  if (!account) {
    alert('Please connect wallet first')
    return
  }

  // Double check network before sending
  const currentChain = await walletClient.getChainId()
  if (currentChain !== ARC_TESTNET.id) {
    alert('Please switch to Arc Testnet first!')
    return
  }

  const recipient = document.getElementById('recipient').value.trim()
  const amount = document.getElementById('amount').value
  const memoText = document.getElementById('memo').value.trim()

  if (!recipient || !amount) {
    alert('Please fill recipient and amount')
    return
  }

  try {
    sendBtn.disabled = true
    sendBtn.textContent = 'Sending...'

    const amountInWei = parseUnits(amount, 6)

    const hash = await walletClient.sendTransaction({
      account,
      to: recipient,
      value: amountInWei,
    })

    console.log('Transaction hash:', hash)
    alert(`Transaction sent!\n\nHash: ${hash}`)

    addToHistory(recipient, amount, memoText, hash)

  } catch (error) {
    console.error('Transaction error:', error)
    alert('Transaction failed. Check console (F12) for details.')
  } finally {
    sendBtn.disabled = false
    sendBtn.textContent = 'Send with Memo'
  }
}

function addToHistory(recipient, amount, memo, txHash) {
  const historyList = document.getElementById('historyList')

  const div = document.createElement('div')
  div.className = 'bg-zinc-900 border border-zinc-800 rounded-2xl p-4'
  div.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <div class="font-mono text-emerald-400 text-lg">${amount} USDC</div>
        <div class="text-xs text-zinc-500 mt-1">To: ${recipient.slice(0, 8)}...${recipient.slice(-6)}</div>
        ${memo ? `<div class="text-sm mt-2 text-zinc-300">"${memo}"</div>` : ''}
      </div>
      <a href="https://testnet.arcscan.app/tx/${txHash}" target="_blank" 
         class="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition">View on Explorer</a>
    </div>
  `

  if (historyList.children.length === 1 && historyList.children[0].classList.contains('text-zinc-500')) {
    historyList.innerHTML = ''
  }

  historyList.prepend(div)
}

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  document.getElementById('historyList').innerHTML = `
    <div class="text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-3xl">
      Your payment history will appear here
    </div>
  `
})