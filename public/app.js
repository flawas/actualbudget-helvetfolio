// API Base URL
const API_BASE = '';

// State
let portfolio = null;

// DOM Elements
const addStockBtn = document.getElementById('addStockBtn');
const updatePricesBtn = document.getElementById('updatePricesBtn');
const refreshBtn = document.getElementById('refreshBtn');
const addStockModal = document.getElementById('addStockModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const addStockForm = document.getElementById('addStockForm');
const stocksList = document.getElementById('stocksList');
const toast = document.getElementById('toast');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const connectBtn = document.getElementById('connectBtn');
const budgetSelectGroup = document.getElementById('budgetSelectGroup');
const budgetIdSelect = document.getElementById('budgetId');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    addStockBtn.addEventListener('click', () => openModal());
    closeModal.addEventListener('click', () => closeModalFn());
    cancelBtn.addEventListener('click', () => closeModalFn());
    addStockForm.addEventListener('submit', handleAddStock);
    updatePricesBtn.addEventListener('click', handleUpdatePrices);
    refreshBtn.addEventListener('click', () => {
        loadPortfolio();
    });

    // Settings Listeners
    settingsBtn.addEventListener('click', openSettingsModal);
    closeSettingsModal.addEventListener('click', closeSettingsModalFn);
    cancelSettingsBtn.addEventListener('click', closeSettingsModalFn);
    settingsForm.addEventListener('submit', handleSaveSettings);
    connectBtn.addEventListener('click', handleConnect);
    document.getElementById('resetSettingsBtn').addEventListener('click', handleResetConnection);

    // Close modal on outside click
    addStockModal.addEventListener('click', (e) => {
        if (e.target === addStockModal) {
            closeModalFn();
        }
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModalFn();
        }
    });
}

// Modal Functions
function openModal() {
    addStockModal.classList.add('active');
    document.getElementById('ticker').focus();
}

function closeModalFn() {
    addStockModal.classList.remove('active');
    addStockForm.reset();
}

async function openSettingsModal() {
    settingsModal.classList.add('active');

    // Reset form state
    budgetSelectGroup.style.display = 'none';
    budgetIdSelect.innerHTML = '<option value="">-- Select a Budget --</option>';

    try {
        const response = await fetch(`${API_BASE}/api/connection`);
        const data = await response.json();

        document.getElementById('serverURL').value = data.serverURL || '';
        document.getElementById('serverPassword').value = ''; // Don't show password

        if (data.budgetId) {
            // If already connected, we might want to show the budget ID or even fetch list
            // For now, let's just create an option for the current one so it's preserved
            // unless the user reconnects.
            budgetIdSelect.innerHTML = `<option value="${data.budgetId}" selected>${data.budgetId} (Current)</option>`;
            budgetSelectGroup.style.display = 'block';
        }

    } catch (error) {
        showError('Failed to load settings');
    }
}

function closeSettingsModalFn() {
    settingsModal.classList.remove('active');
    settingsForm.reset();
}

async function handleConnect() {
    const serverURL = document.getElementById('serverURL').value;
    const password = document.getElementById('serverPassword').value;

    if (!serverURL) {
        showError('Server URL is required');
        return;
    }

    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        budgetSelectGroup.style.display = 'none';

        // Update connection first (without budget ID)
        await fetch(`${API_BASE}/api/connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverURL, password })
        });

        // Now fetch budgets
        const response = await fetch(`${API_BASE}/api/budgets`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to fetch budgets');
        }

        // Populate select
        budgetIdSelect.innerHTML = '<option value="">-- Select a Budget --</option>';

        if (!result.budgets || result.budgets.length === 0) {
            showToast('Connected, but no budgets found on this server.', 'error');
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No budgets found";
            option.disabled = true;
            budgetIdSelect.appendChild(option);
        } else {
            result.budgets.forEach(budget => {
                const option = document.createElement('option');
                // downloadBudget() only accepts groupId — always use groupId as the stored
                // budgetId so it works even after the local cache is cleared.
                const id = budget.groupId || budget.id || budget.syncId || budget.cloudFileId || budget.fileId;
                const name = budget.name || 'Untitled Budget';
                const subtext = budget.cloudFileId ? ` (${budget.cloudFileId.substring(0, 8)}...)` : '';

                if (id) {
                    option.value = id;
                    option.textContent = `${name}${subtext}`;
                    budgetIdSelect.appendChild(option);
                } else {
                    console.warn('Skipping budget with no ID:', budget);
                }
            });
            showSuccess('Connected! Please select a budget.');
        }

        budgetSelectGroup.style.display = 'block';

    } catch (error) {
        showError('Connection failed: ' + error.message);
    } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Test Connection & List Budgets';
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();

    const serverURL = document.getElementById('serverURL').value;
    const password = document.getElementById('serverPassword').value;
    const budgetId = budgetIdSelect.value;

    if (!budgetId || budgetId === 'undefined' || budgetId === 'null') {
        showError('Please select a valid budget');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverURL, password, budgetId })
        });

        if (!response.ok) {
            throw new Error('Failed to save settings');
        }

        showSuccess('Settings saved successfully!');
        closeSettingsModalFn();
        loadPortfolio();
    } catch (error) {
        showError(error.message);
    }
}

async function handleResetConnection() {
    if (!confirm('Are you sure you want to reset all connection data? This will clear your server URL and saved credentials.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/connection`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to reset connection settings');
        }

        showSuccess('Connection settings reset successfully!');
        closeSettingsModalFn();

        // Re-open modal to show fresh state (defaults from env)
        setTimeout(() => openSettingsModal(), 500);
    } catch (error) {
        showError(error.message);
    }
}

// API Functions
async function loadPortfolio() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/api/performance`);

        if (!response.ok) {
            throw new Error('Failed to load portfolio');
        }

        portfolio = await response.json();
        renderPortfolio();
    } catch (error) {
        showError('Failed to load portfolio: ' + error.message);
        stocksList.innerHTML = `
            <div class="loading" style="color: var(--danger-color);">
                ❌ Error loading portfolio
                <br><small>${error.message}</small>
            </div>
        `;
    }
}

async function handleAddStock(e) {
    e.preventDefault();

    const ticker = document.getElementById('ticker').value.trim().toUpperCase();
    const quantity = parseFloat(document.getElementById('quantity').value);
    const purchaseDate = document.getElementById('purchaseDate').value;
    const purchasePrice = document.getElementById('purchasePrice').value;

    const data = { ticker, quantity };
    if (purchaseDate) data.purchaseDate = purchaseDate;
    if (purchasePrice) data.purchasePrice = parseFloat(purchasePrice);

    try {
        const response = await fetch(`${API_BASE}/api/stocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to add stock');
        }

        showSuccess(`Successfully added ${ticker}!`);
        closeModalFn();
        loadPortfolio();
    } catch (error) {
        showError(error.message);
    }
}

async function handleRemoveStock(ticker) {
    if (!confirm(`Are you sure you want to remove ${ticker} from your portfolio?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/stocks/${ticker}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to remove stock');
        }

        showSuccess(`Successfully removed ${ticker}!`);
        loadPortfolio();
    } catch (error) {
        showError(error.message);
    }
}

async function handleUpdatePrices() {
    try {
        updatePricesBtn.disabled = true;
        updatePricesBtn.innerHTML = '⏳ Updating...';

        const response = await fetch(`${API_BASE}/api/update-prices`, {
            method: 'POST'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to update prices');
        }

        showSuccess('Prices updated successfully!');
        loadPortfolio();
    } catch (error) {
        showError(error.message);
    } finally {
        updatePricesBtn.disabled = false;
        updatePricesBtn.innerHTML = '🔄 Update Prices';
    }
}

// Rendering Functions
function renderPortfolio() {
    if (!portfolio || portfolio.totalStocks === 0) {
        stocksList.innerHTML = `
            <div class="loading">
                📊 No stocks in portfolio yet
                <br><small>Click "Add Stock" to get started</small>
            </div>
        `;
        updateSummary({ totalStocks: 0, totalValue: 0, totalGain: 0, totalGainPercent: 0 });
        return;
    }

    // Update summary
    updateSummary(portfolio);

    // Render stock cards
    stocksList.innerHTML = portfolio.stocks.map(stock => createStockCard(stock)).join('');

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-stock-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRemoveStock(btn.dataset.ticker));
    });
}

function createStockCard(stock) {
    const gainClass = stock.gain >= 0 ? 'positive' : 'negative';
    const gainSign = stock.gain >= 0 ? '+' : '';

    return `
        <div class="stock-card">
            <div class="stock-header">
                <div class="stock-title">
                    <div class="stock-ticker">${stock.ticker}</div>
                    <div class="stock-name">${stock.name}</div>
                </div>
                <div class="stock-actions">
                    <button class="icon-btn remove-stock-btn" data-ticker="${stock.ticker}" title="Remove stock">
                        🗑️
                    </button>
                </div>
            </div>
            
            <div class="stock-details">
                <div class="detail-row">
                    <span class="detail-label">Quantity</span>
                    <span class="detail-value">${stock.quantity}</span>
                </div>
                
                ${stock.purchaseDate ? `
                <div class="detail-row">
                    <span class="detail-label">Purchase Date</span>
                    <span class="detail-value">${new Date(stock.purchaseDate).toLocaleDateString()}</span>
                </div>
                ` : ''}
                
                <div class="detail-row">
                    <span class="detail-label">Purchase Price</span>
                    <span class="detail-value">${stock.purchasePrice.toFixed(2)} ${stock.currency}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Cost Basis</span>
                    <span class="detail-value">${stock.costBasis.toFixed(2)} ${stock.currency}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Current Price</span>
                    <span class="detail-value">${stock.currentPrice.toFixed(2)} ${stock.currency}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Current Value</span>
                    <span class="detail-value">${stock.currentValue.toFixed(2)} ${stock.currency}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Gain/Loss</span>
                    <span class="gain-badge ${gainClass}">
                        ${gainSign}${stock.gain.toFixed(2)} ${stock.currency} (${gainSign}${stock.gainPercent.toFixed(2)}%)
                    </span>
                </div>
            </div>
        </div>
    `;
}

function updateSummary(data) {
    document.getElementById('totalStocks').textContent = data.totalStocks;
    document.getElementById('totalValue').textContent = `${data.totalValue.toFixed(2)} CHF`;

    const gainElement = document.getElementById('totalGain');
    const gainClass = data.totalGain >= 0 ? 'positive' : 'negative';
    const gainSign = data.totalGain >= 0 ? '+' : '';

    gainElement.textContent = `${gainSign}${data.totalGain.toFixed(2)} CHF (${gainSign}${data.totalGainPercent.toFixed(2)}%)`;
    gainElement.className = `summary-value ${gainClass}`;
}

function showLoading() {
    stocksList.innerHTML = '<div class="loading">⏳ Loading portfolio...</div>';
}

// Toast Notifications
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}
