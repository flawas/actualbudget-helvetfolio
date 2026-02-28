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
    document.getElementById('removeWebPasswordBtn').addEventListener('click', handleRemoveWebPassword);

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
    document.getElementById('webPassword').value = '';

    try {
        const response = await fetch(`${API_BASE}/api/connection`);
        const data = await response.json();

        document.getElementById('serverURL').value = data.serverURL || '';
        document.getElementById('serverPassword').value = '';

        if (data.budgetId) {
            budgetIdSelect.innerHTML = `<option value="${data.budgetId}" selected>${data.budgetId} (Current)</option>`;
            budgetSelectGroup.style.display = 'block';
        }

        // Update web password section
        const hint = document.getElementById('webPasswordHint');
        const removeRow = document.getElementById('removeWebPasswordRow');
        if (data.webPasswordFromEnv) {
            hint.textContent = 'Password set via WEB_PASSWORD environment variable — cannot be changed here';
            document.getElementById('webPassword').disabled = true;
            removeRow.style.display = 'none';
        } else if (data.hasWebPassword) {
            hint.textContent = 'Password is set — enter a new one to change it';
            document.getElementById('webPassword').disabled = false;
            removeRow.style.display = 'block';
        } else {
            hint.textContent = 'No password set — anyone on the network can access the UI';
            document.getElementById('webPassword').disabled = false;
            removeRow.style.display = 'none';
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
    const webPassword = document.getElementById('webPassword').value;

    if (!budgetId || budgetId === 'undefined' || budgetId === 'null') {
        showError('Please select a valid budget');
        return;
    }

    // Only include webPassword when the user typed something new
    const payload = { serverURL, password, budgetId, ...(webPassword ? { webPassword } : {}) };

    try {
        const response = await fetch(`${API_BASE}/api/connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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

async function handleRemoveWebPassword() {
    if (!confirm('Remove the web UI password? The interface will be accessible without authentication.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webPassword: '' })
        });

        if (!response.ok) throw new Error('Failed to remove web password');

        showSuccess('Web password removed');
        openSettingsModal(); // Refresh the modal state
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
            <div class="loading" style="color: var(--danger);">
                Error loading portfolio
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
        updatePricesBtn.textContent = 'Updating...';

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
        updatePricesBtn.textContent = 'Update Prices';
    }
}

// Rendering Functions
function renderPortfolio() {
    if (!portfolio || portfolio.totalStocks === 0) {
        stocksList.innerHTML = `
            <div class="loading">
                No stocks in portfolio yet
                <br><small>Click "Add Stock" to get started</small>
            </div>
        `;
        updateSummary({ totalStocks: 0, totalValue: 0, totalGain: 0, totalGainPercent: 0 });
        updateSyncInfo(null, null);
        return;
    }

    updateSummary(portfolio);
    updateSyncInfo(portfolio.lastYahooSync, portfolio.lastActualSync);

    stocksList.innerHTML = `
        <div class="table-wrapper">
            <table class="stocks-table">
                <thead>
                    <tr>
                        <th class="col-stock">Stock</th>
                        <th class="col-qty num">Qty</th>
                        <th class="col-date">Purchase Date</th>
                        <th class="col-buy num">Buy Price</th>
                        <th class="col-cost num">Cost Basis</th>
                        <th class="col-price num">Current Price</th>
                        <th class="col-value num">Value</th>
                        <th class="col-gain num">Gain / Loss</th>
                        <th class="col-actions"></th>
                    </tr>
                </thead>
                <tbody>
                    ${portfolio.stocks.map(stock => createStockRow(stock)).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.remove-stock-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRemoveStock(btn.dataset.ticker));
    });

    document.querySelectorAll('.editable').forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
}

function createStockRow(stock) {
    const gainClass = stock.gain >= 0 ? 'positive' : 'negative';
    const gainSign = stock.gain >= 0 ? '+' : '';
    const purchasePrice = stock.purchasePrice ?? 0;
    const displayDate = stock.purchaseDate
        ? new Date(stock.purchaseDate + 'T00:00:00').toLocaleDateString('en-CH')
        : '—';

    return `
        <tr data-ticker="${stock.ticker}">
            <td class="col-stock" data-label="Stock">
                <div class="stock-cell">
                    <span class="ticker-badge">${stock.ticker}</span>
                    <span class="name-cell" title="${stock.name}">${stock.name}</span>
                </div>
            </td>
            <td class="col-qty num editable" data-field="quantity" data-ticker="${stock.ticker}" data-value="${stock.quantity}" data-label="Qty">${stock.quantity}</td>
            <td class="col-date editable" data-field="purchaseDate" data-ticker="${stock.ticker}" data-value="${stock.purchaseDate || ''}" data-label="Purchase Date">${displayDate}</td>
            <td class="col-buy num editable" data-field="purchasePrice" data-ticker="${stock.ticker}" data-value="${purchasePrice}" data-label="Buy Price">${purchasePrice.toFixed(2)} ${stock.currency}</td>
            <td class="col-cost num" data-label="Cost Basis">${stock.costBasis.toFixed(2)} ${stock.currency}</td>
            <td class="col-price num" data-label="Current Price">${stock.currentPrice.toFixed(2)} ${stock.currency}</td>
            <td class="col-value num" data-label="Value">${stock.currentValue.toFixed(2)} ${stock.currency}</td>
            <td class="col-gain num" data-label="Gain / Loss"><span class="gain-badge ${gainClass}">${gainSign}${stock.gain.toFixed(2)} (${gainSign}${stock.gainPercent.toFixed(2)}%)</span></td>
            <td class="col-actions"><button class="icon-btn remove-stock-btn" data-ticker="${stock.ticker}" title="Remove">&#x1F5D1;</button></td>
        </tr>
    `;
}

function handleCellClick(e) {
    const cell = e.currentTarget;
    if (cell.querySelector('.cell-input')) return; // Already editing

    const field = cell.dataset.field;
    const ticker = cell.dataset.ticker;
    const value = cell.dataset.value;

    const input = document.createElement('input');
    input.className = 'cell-input';

    if (field === 'quantity' || field === 'purchasePrice') {
        input.type = 'number';
        input.min = '0';
        input.step = '0.01';
        input.style.textAlign = 'right';
    } else if (field === 'purchaseDate') {
        input.type = 'date';
    }

    input.value = value;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { input.blur(); }
        if (ev.key === 'Escape') { loadPortfolio(); }
    });

    let saved = false;
    input.addEventListener('blur', () => {
        if (!saved) { saved = true; saveCellEdit(ticker, field, input.value); }
    });
}

async function saveCellEdit(ticker, field, newValue) {
    try {
        if (field === 'quantity') {
            const response = await fetch(`${API_BASE}/api/stocks/${ticker}/quantity`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: parseFloat(newValue) })
            });
            if (!response.ok) throw new Error((await response.json()).error);
        } else {
            const body = {};
            if (field === 'purchaseDate') body.purchaseDate = newValue;
            if (field === 'purchasePrice') body.purchasePrice = parseFloat(newValue);
            const response = await fetch(`${API_BASE}/api/stocks/${ticker}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error((await response.json()).error);
        }
        showSuccess('Saved');
    } catch (error) {
        showError(error.message);
    }
    loadPortfolio();
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

function updateSyncInfo(lastYahooSync, lastActualSync) {
    const el = document.getElementById('syncInfo');
    if (!lastYahooSync && !lastActualSync) {
        el.textContent = 'Prices not yet synced';
        return;
    }

    const fmt = (iso) => {
        if (!iso) return 'never';
        return new Date(iso).toLocaleString('en-CH', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    el.innerHTML =
        `<span>Yahoo Finance: ${fmt(lastYahooSync)}</span>` +
        `<span class="sync-separator">·</span>` +
        `<span>Actual Budget: ${fmt(lastActualSync)}</span>`;
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
