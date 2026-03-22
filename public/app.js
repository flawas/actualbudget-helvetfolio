// API Base URL
const API_BASE = '';

// ─── Auth ─────────────────────────────────────────────────────────────────────
let _authHeader  = sessionStorage.getItem('_helvetfolio_auth') || null;
let _authPromise = null; // Shared across concurrent 401s so only one modal shows

/**
 * Drop-in fetch wrapper. Injects Basic Auth header and handles 401 with a
 * styled modal. Multiple concurrent calls share a single login flow.
 */
async function apiFetch(url, options = {}) {
    const makeHeaders = () => {
        const h = { ...(options.headers || {}) };
        if (_authHeader) h['Authorization'] = _authHeader;
        return h;
    };

    const res = await fetch(url, { ...options, headers: makeHeaders() });

    if (res.status === 401) {
        // Ensure only one login modal runs at a time; all other 401s wait for it
        if (!_authPromise) {
            _authPromise = _runLoginFlow().finally(() => { _authPromise = null; });
        }
        await _authPromise;
        // Retry with whatever auth state _runLoginFlow left behind
        return fetch(url, { ...options, headers: makeHeaders() });
    }

    return res;
}

async function _runLoginFlow(showError = false) {
    const password = await _promptPassword(showError);
    if (!password) return; // Modal closed without submitting

    const candidate = 'Basic ' + btoa(':' + password);
    const test = await fetch(`${API_BASE}/api/performance`, {
        headers: { 'Authorization': candidate }
    });

    if (test.status === 401) {
        // Wrong password — re-show with error message
        return _runLoginFlow(true);
    }

    // Correct — store and close modal
    _authHeader = candidate;
    sessionStorage.setItem('_helvetfolio_auth', _authHeader);
    document.getElementById('loginModal').classList.remove('active');
}

let _loginResolve = null;

function _promptPassword(showError = false) {
    return new Promise(resolve => {
        _loginResolve = resolve;
        const errEl = document.getElementById('loginError');
        const pwdEl = document.getElementById('loginPassword');
        errEl.style.display = showError ? 'block' : 'none';
        pwdEl.value = '';
        document.getElementById('loginModal').classList.add('active');
        setTimeout(() => pwdEl.focus(), 80);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const val = document.getElementById('loginPassword').value;
        if (_loginResolve) { _loginResolve(val); _loginResolve = null; }
    });
});

// ─── State ────────────────────────────────────────────────────────────────────
let portfolio = null;
let sortKey = null;
let sortDir = 'asc';
let groups = [];
let collapsedGroups = new Set();
let activeGroupDropdown = null;

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

// ─── Generic Dialog (replaces native confirm / prompt) ────────────────────────

const dialogModal    = document.getElementById('dialogModal');
const dialogTitle    = document.getElementById('dialogTitle');
const dialogMessage  = document.getElementById('dialogMessage');
const dialogInputGrp = document.getElementById('dialogInputGroup');
const dialogInput    = document.getElementById('dialogInput');
const dialogConfirm  = document.getElementById('dialogConfirmBtn');
const dialogCancel   = document.getElementById('dialogCancelBtn');
const closeDialogBtn = document.getElementById('closeDialogModal');

let _dialogResolve = null;

function _closeDialog(value) {
    dialogModal.classList.remove('active');
    if (_dialogResolve) { _dialogResolve(value); _dialogResolve = null; }
}

closeDialogBtn.addEventListener('click', () => _closeDialog(null));
dialogCancel.addEventListener('click', () => _closeDialog(null));
dialogModal.addEventListener('click', (e) => { if (e.target === dialogModal) _closeDialog(null); });

/**
 * Show a styled confirm dialog. Returns Promise<boolean>.
 */
function showConfirm(title, message, confirmLabel = 'Confirm', danger = false) {
    return new Promise(resolve => {
        _dialogResolve = resolve;
        dialogTitle.textContent = title;
        dialogMessage.textContent = message;
        dialogInputGrp.style.display = 'none';
        dialogConfirm.textContent = confirmLabel;
        dialogConfirm.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
        dialogModal.classList.add('active');
        dialogInput.value = '';

        const handler = () => {
            dialogConfirm.removeEventListener('click', handler);
            _closeDialog(true);
        };
        dialogConfirm.addEventListener('click', handler);
    });
}

/**
 * Show a styled prompt dialog. Returns Promise<string|null> (null = cancelled).
 */
function showPrompt(title, message, defaultValue = '', confirmLabel = 'Save') {
    return new Promise(resolve => {
        _dialogResolve = resolve;
        dialogTitle.textContent = title;
        dialogMessage.textContent = message;
        dialogInputGrp.style.display = 'block';
        dialogInput.value = defaultValue;
        dialogConfirm.textContent = confirmLabel;
        dialogConfirm.className = 'btn btn-primary';
        dialogModal.classList.add('active');
        setTimeout(() => { dialogInput.focus(); dialogInput.select(); }, 50);

        const submit = () => {
            dialogConfirm.removeEventListener('click', submit);
            dialogInput.removeEventListener('keydown', onKey);
            _closeDialog(dialogInput.value);
        };
        const onKey = (e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') { dialogConfirm.removeEventListener('click', submit); dialogInput.removeEventListener('keydown', onKey); _closeDialog(null); }
        };
        dialogConfirm.addEventListener('click', submit);
        dialogInput.addEventListener('keydown', onKey);
    });
}

// ─── Initialize ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
    updateAddStockButtonState();
    setupEventListeners();
});

async function updateAddStockButtonState() {
    try {
        const response = await apiFetch(`${API_BASE}/api/connection`);
        const data = await response.json();
        const configured = !!data.serverURL;
        addStockBtn.disabled = !configured;
        addStockBtn.title = configured ? '' : 'Configure Actual Budget connection in Settings first';
    } catch {
        addStockBtn.disabled = true;
        addStockBtn.title = 'Configure Actual Budget connection in Settings first';
    }
}

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
        const response = await apiFetch(`${API_BASE}/api/connection`);
        const data = await response.json();

        document.getElementById('serverURL').value = data.serverURL || '';
        document.getElementById('serverPassword').value = '';

        if (data.budgetId) {
            const displayName = data.budgetName || data.budgetId;
            budgetIdSelect.innerHTML = `<option value="${data.budgetId}" selected>${displayName} (Current)</option>`;
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
        console.error('Failed to load settings:', error);
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
        await apiFetch(`${API_BASE}/api/connection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverURL, password })
        });

        // Now fetch budgets
        const response = await apiFetch(`${API_BASE}/api/budgets`);
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
    const budgetName = budgetIdSelect.selectedOptions[0]?.textContent?.replace(' (Current)', '').trim() || '';
    const webPassword = document.getElementById('webPassword').value;

    if (!budgetId || budgetId === 'undefined' || budgetId === 'null') {
        showError('Please select a valid budget');
        return;
    }

    // Only include webPassword when the user typed something new
    const payload = { serverURL, password, budgetId, budgetName, ...(webPassword ? { webPassword } : {}) };

    try {
        const response = await apiFetch(`${API_BASE}/api/connection`, {
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
        updateAddStockButtonState();
    } catch (error) {
        showError(error.message);
    }
}

async function handleRemoveWebPassword() {
    if (!await showConfirm('Remove Web Password', 'Remove the web UI password? The interface will be accessible without authentication.', 'Remove', true)) {
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/api/connection`, {
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
    if (!await showConfirm('Reset Connection Data', 'Are you sure you want to reset all connection data? This will clear your server URL and saved credentials.', 'Reset', true)) {
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/api/connection`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to reset connection settings');
        }

        showSuccess('Connection settings reset successfully!');
        closeSettingsModalFn();
        updateAddStockButtonState();

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
        const response = await apiFetch(`${API_BASE}/api/performance`);

        if (!response.ok) {
            throw new Error('Failed to load portfolio');
        }

        portfolio = await response.json();
        groups = portfolio.groups || [];
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
    const quantity = Number.parseFloat(document.getElementById('quantity').value);
    const purchaseDate = document.getElementById('purchaseDate').value;
    const purchasePrice = document.getElementById('purchasePrice').value;

    const data = { ticker, quantity };
    if (purchaseDate) data.purchaseDate = purchaseDate;
    if (purchasePrice) data.purchasePrice = Number.parseFloat(purchasePrice);

    try {
        const response = await apiFetch(`${API_BASE}/api/stocks`, {
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
    if (!await showConfirm('Remove Stock', `Remove ${ticker} from your portfolio?`, 'Remove', true)) {
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/api/stocks/${ticker}`, {
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

        const response = await apiFetch(`${API_BASE}/api/update-prices`, {
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
function sortIndicator(key) {
    if (sortKey !== key) return '<span class="sort-icon">⇅</span>';
    return `<span class="sort-icon active">${sortDir === 'asc' ? '↑' : '↓'}</span>`;
}

function sortStocks(stocks) {
    return [...stocks].sort((a, b) => {
        if (!sortKey) return 0;
        const va = a[sortKey];
        const vb = b[sortKey];
        if (va == null && vb == null) return 0;
        if (va == null) return sortDir === 'asc' ? 1 : -1;
        if (vb == null) return sortDir === 'asc' ? -1 : 1;
        if (typeof va === 'string') {
            const cmp = va.localeCompare(vb);
            return sortDir === 'asc' ? cmp : -cmp;
        }
        return sortDir === 'asc' ? va - vb : vb - va;
    });
}

function createGroupRow(group, memberStocks) {
    const totalValue = memberStocks.reduce((s, st) => s + st.currentValue, 0);
    const totalGain  = memberStocks.reduce((s, st) => s + st.gain, 0);
    const totalCost  = memberStocks.reduce((s, st) => s + st.costBasis, 0);
    const gainPct    = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const gainClass  = totalGain >= 0 ? 'positive' : 'negative';
    const gainSign   = totalGain >= 0 ? '+' : '';
    const currency   = memberStocks[0]?.currency || 'CHF';
    const collapsed  = collapsedGroups.has(group.id);
    const count      = memberStocks.length;

    return `
        <tr class="group-row${collapsed ? ' collapsed' : ''}" data-group-id="${group.id}">
            <td class="col-stock">
                <div class="group-cell">
                    <span class="group-toggle">${collapsed ? '▶' : '▼'}</span>
                    <span class="group-name-label" data-group-id="${group.id}" title="Double-click to rename">${group.name}</span>
                    <span class="group-count">${count} stock${count !== 1 ? 's' : ''}</span>
                </div>
            </td>
            <td class="col-qty"></td>
            <td class="col-date"></td>
            <td class="col-buy"></td>
            <td class="col-cost"></td>
            <td class="col-price"></td>
            <td class="col-value num">${totalValue.toFixed(2)} ${currency}</td>
            <td class="col-gain num"><span class="gain-badge ${gainClass}">${gainSign}${totalGain.toFixed(2)} (${gainSign}${gainPct.toFixed(2)}%)</span></td>
            <td class="col-actions"><button class="icon-btn group-delete-btn" data-group-id="${group.id}" title="Delete group">✕</button></td>
        </tr>
    `;
}

function renderPortfolio() {
    closeGroupDropdown();

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

    // Build group → stocks map
    const stocksByGroup = new Map();
    const ungrouped = [];
    for (const stock of portfolio.stocks) {
        if (stock.groupId) {
            if (!stocksByGroup.has(stock.groupId)) stocksByGroup.set(stock.groupId, []);
            stocksByGroup.get(stock.groupId).push(stock);
        } else {
            ungrouped.push(stock);
        }
    }

    const hasGroups = groups.length > 0;
    let bodyRows = '';

    // Render each defined group (sorted alphabetically)
    for (const group of [...groups].sort((a, b) => a.name.localeCompare(b.name))) {
        const members = sortStocks(stocksByGroup.get(group.id) || []);
        const collapsed = collapsedGroups.has(group.id);
        bodyRows += createGroupRow(group, members);
        if (!collapsed) {
            bodyRows += members.map(stock => createStockRow(stock, true)).join('');
        }
    }

    // Render ungrouped stocks
    if (hasGroups && ungrouped.length > 0) {
        bodyRows += `
            <tr class="group-row ungrouped-row${collapsedGroups.has('__ungrouped__') ? ' collapsed' : ''}" data-group-id="__ungrouped__">
                <td class="col-stock">
                    <div class="group-cell">
                        <span class="group-toggle">${collapsedGroups.has('__ungrouped__') ? '▶' : '▼'}</span>
                        <span class="group-name-label">No group</span>
                        <span class="group-count">${ungrouped.length} stock${ungrouped.length !== 1 ? 's' : ''}</span>
                    </div>
                </td>
                <td class="col-qty"></td><td class="col-date"></td><td class="col-buy"></td>
                <td class="col-cost"></td><td class="col-price"></td><td class="col-value"></td>
                <td class="col-gain"></td><td class="col-actions"></td>
            </tr>
        `;
        if (!collapsedGroups.has('__ungrouped__')) {
            bodyRows += sortStocks(ungrouped).map(stock => createStockRow(stock, true)).join('');
        }
    } else if (!hasGroups) {
        bodyRows = sortStocks(ungrouped).map(stock => createStockRow(stock, true)).join('');
    }

    stocksList.innerHTML = `
        <div class="table-wrapper">
            <table class="stocks-table">
                <thead>
                    <tr>
                        <th class="col-stock sortable" data-sort="ticker">Stock ${sortIndicator('ticker')}</th>
                        <th class="col-qty num sortable" data-sort="quantity">Qty ${sortIndicator('quantity')}</th>
                        <th class="col-date sortable" data-sort="purchaseDate">Purchase Date ${sortIndicator('purchaseDate')}</th>
                        <th class="col-buy num sortable" data-sort="purchasePrice">Buy Price ${sortIndicator('purchasePrice')}</th>
                        <th class="col-cost num sortable" data-sort="costBasis">Cost Basis ${sortIndicator('costBasis')}</th>
                        <th class="col-price num sortable" data-sort="currentPrice">Current Price ${sortIndicator('currentPrice')}</th>
                        <th class="col-value num sortable" data-sort="currentValue">Value ${sortIndicator('currentValue')}</th>
                        <th class="col-gain num sortable" data-sort="gain">Gain / Loss ${sortIndicator('gain')}</th>
                        <th class="col-actions"></th>
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>
    `;

    // Sort header clicks
    document.querySelectorAll('.stocks-table thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            sortKey === key ? (sortDir = sortDir === 'asc' ? 'desc' : 'asc') : (sortKey = key, sortDir = 'asc');
            renderPortfolio();
        });
    });

    // Group row toggle (collapse/expand)
    document.querySelectorAll('.group-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.group-delete-btn') || e.target.closest('.group-name-label')) return;
            const id = row.dataset.groupId;
            collapsedGroups.has(id) ? collapsedGroups.delete(id) : collapsedGroups.add(id);
            renderPortfolio();
        });
    });

    // Group name double-click to rename
    document.querySelectorAll('.group-name-label[data-group-id]').forEach(el => {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            handleGroupRename(el.dataset.groupId, el.textContent.trim());
        });
    });

    // Group delete
    document.querySelectorAll('.group-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleGroupDelete(btn.dataset.groupId);
        });
    });

    // Stock group assign button
    document.querySelectorAll('.group-assign-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showGroupDropdown(btn.dataset.accountId, btn);
        });
    });

    // Stock remove & inline edit
    document.querySelectorAll('.remove-stock-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRemoveStock(btn.dataset.ticker));
    });
    document.querySelectorAll('.editable').forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
}

function createStockRow(stock, showGroupBtn = false) {
    const gainClass = stock.gain >= 0 ? 'positive' : 'negative';
    const gainSign = stock.gain >= 0 ? '+' : '';
    const purchasePrice = stock.purchasePrice ?? 0;
    const displayDate = stock.purchaseDate
        ? new Date(stock.purchaseDate + 'T00:00:00').toLocaleDateString('en-CH')
        : '—';
    const groupName = stock.groupId ? (groups.find(g => g.id === stock.groupId)?.name || '') : '';
    const groupBtnLabel = groupName || '＋ Group';
    const groupBtn = showGroupBtn
        ? `<button class="group-assign-btn${groupName ? ' has-group' : ''}" data-account-id="${stock.accountId}" title="Assign to group">${groupBtnLabel}</button>`
        : '';
    const memberClass = showGroupBtn ? 'member-row' : '';

    return `
        <tr data-ticker="${stock.ticker}" class="${memberClass}">
            <td class="col-stock" data-label="Stock">
                <div class="stock-cell">
                    <span class="ticker-badge">${stock.ticker}</span>
                    <span class="name-cell" title="${stock.name}">${stock.name}</span>
                    ${groupBtn}
                </div>
            </td>
            <td class="col-qty num editable" data-field="quantity" data-ticker="${stock.ticker}" data-value="${stock.quantity}" data-label="Qty">${Number(stock.quantity).toFixed(4)}</td>
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

// ─── Group management ─────────────────────────────────────────────────────────

function closeGroupDropdown() {
    if (activeGroupDropdown) {
        activeGroupDropdown.remove();
        activeGroupDropdown = null;
    }
}

function showGroupDropdown(accountId, anchorEl) {
    closeGroupDropdown();

    const div = document.createElement('div');
    div.className = 'group-dropdown';

    const currentGroupId = portfolio.stocks.find(s => s.accountId === accountId)?.groupId || '';
    const items = [
        { id: '', label: 'No group' },
        ...groups.map(g => ({ id: g.id, label: g.name }))
    ];

    div.innerHTML = items.map(item => `
        <div class="group-dropdown-item${item.id === currentGroupId ? ' active' : ''}" data-group-id="${item.id}">${item.label}</div>
    `).join('') + `
        <div class="group-dropdown-divider"></div>
        <div class="group-dropdown-item group-dropdown-new">＋ New group</div>
    `;

    const rect = anchorEl.getBoundingClientRect();
    div.style.top = `${rect.bottom + 4}px`;
    div.style.left = `${rect.left}px`;

    div.addEventListener('click', async (e) => {
        const item = e.target.closest('[data-group-id]');
        const isNew = e.target.classList.contains('group-dropdown-new');
        if (isNew) {
            closeGroupDropdown();
            const name = await showPrompt('New Group', 'Enter a name for the new group:', '', 'Create');
            if (!name?.trim()) return;
            const res = await apiFetch(`${API_BASE}/api/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            if (!res.ok) { showError((await res.json()).error); return; }
            const { group } = await res.json();
            await assignStockGroup(accountId, group.id);
        } else if (item) {
            closeGroupDropdown();
            await assignStockGroup(accountId, item.dataset.groupId || null);
        }
    });

    document.body.appendChild(div);
    activeGroupDropdown = div;

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeGroupDropdown, { once: true });
    }, 0);
}

async function assignStockGroup(accountId, groupId) {
    const res = await apiFetch(`${API_BASE}/api/stocks/by-account/${accountId}/group`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: groupId || null })
    });
    if (!res.ok) { showError((await res.json()).error); return; }
    loadPortfolio();
}

async function handleGroupDelete(groupId) {
    const group = groups.find(g => g.id === groupId);
    if (!await showConfirm('Delete Group', `Delete group "${group?.name}"? Stocks will be ungrouped.`, 'Delete', true)) return;
    const res = await apiFetch(`${API_BASE}/api/groups/${groupId}`, { method: 'DELETE' });
    if (!res.ok) { showError((await res.json()).error); return; }
    collapsedGroups.delete(groupId);
    loadPortfolio();
}

async function handleGroupRename(groupId, currentName) {
    const name = await showPrompt('Rename Group', 'Enter a new name for the group:', currentName, 'Rename');
    if (!name?.trim() || name.trim() === currentName) return;
    const res = await apiFetch(`${API_BASE}/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });
    if (!res.ok) { showError((await res.json()).error); return; }
    loadPortfolio();
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
            const response = await apiFetch(`${API_BASE}/api/stocks/${ticker}/quantity`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: Number.parseFloat(newValue) })
            });
            if (!response.ok) throw new Error((await response.json()).error);
        } else {
            const body = {};
            if (field === 'purchaseDate') body.purchaseDate = newValue;
            if (field === 'purchasePrice') body.purchasePrice = Number.parseFloat(newValue);
            const response = await apiFetch(`${API_BASE}/api/stocks/${ticker}`, {
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
