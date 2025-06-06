document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const tradeForm = document.getElementById('tradeForm');
    const tradeTableBody = document.getElementById('tradeTableBody');
    const realAccountBtn = document.getElementById('realAccountBtn');
    const demoAccountBtn = document.getElementById('demoAccountBtn');
    const filterAccount = document.getElementById('filterAccount');
    const filterInstrument = document.getElementById('filterInstrument');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const applyFilters = document.getElementById('applyFilters');
    const resetFilters = document.getElementById('resetFilters');
    const editModal = document.getElementById('editModal');
    const closeModal = document.querySelectorAll('.close-modal');
    const editTradeForm = document.getElementById('editTradeForm');
    const updateTradeBtn = document.getElementById('updateTradeBtn');
    const deleteTradeBtn = document.getElementById('deleteTradeBtn');
    const realProfitEl = document.getElementById('realProfit');
    const demoProfitEl = document.getElementById('demoProfit');
    const winRateEl = document.getElementById('winRate');
    const totalTradesEl = document.getElementById('totalTrades');
    const tradeCountEl = document.getElementById('tradeCount');
    const emptyStateEl = document.getElementById('emptyState');
    const formToggle = document.getElementById('formToggle');
    const formCollapse = document.getElementById('formCollapse');
    const deleteModal = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const depositAmount = document.getElementById('depositAmount');
    const depositAccount = document.getElementById('depositAccount');
    const addDepositBtn = document.getElementById('addDepositBtn');
    const depositTableBody = document.getElementById('depositTableBody');

    // Initialize date pickers
    flatpickr("#tradeDate", {
        defaultDate: "today",
        maxDate: "today"
    });

    flatpickr("#filterDateFrom");
    flatpickr("#filterDateTo");

    // Chart initialization
    const profitChart = new Chart(
        document.getElementById('profitChart'),
        {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Real Account P/L',
                        data: [],
                        borderColor: 'rgba(67, 97, 238, 1)',
                        backgroundColor: 'rgba(67, 97, 238, 0.1)',
                        tension: 0.1,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Demo Account P/L',
                        data: [],
                        borderColor: 'rgba(114, 9, 183, 1)',
                        backgroundColor: 'rgba(114, 9, 183, 0.1)',
                        tension: 0.1,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        }
    );

    // State
    let trades = JSON.parse(localStorage.getItem('trades')) || [];
    // Initialize deposits
    let deposits = JSON.parse(localStorage.getItem('deposits')) || [];
    let currentView = 'real'; // 'real' or 'demo'
    let currentEditId = null;
    let sortConfig = {
        key: 'datetime',
        direction: 'desc'
    };

    // Save deposits to localStorage
    function saveDeposits() {
        localStorage.setItem('deposits', JSON.stringify(deposits));
    }


    // Initialize the app
    function init() {
        renderTrades();
        renderDeposits(); // Add this line
        updateStats();
        updateChart();
        populateInstrumentFilter();
        updateTradeCount();

        // Set default dates for filters
        const today = new Date().toISOString().split('T')[0];
        filterDateTo.value = today;

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        filterDateFrom.value = oneMonthAgo.toISOString().split('T')[0];

        // Set default trade date/time to now
        document.getElementById('tradeDate').value = today;
        const now = new Date();
        document.getElementById('tradeTime').value = now.toTimeString().substring(0, 5);

        // Initialize mobile collapse
        if (window.innerWidth < 768) {
            formCollapse.classList.add('collapsed');
            formToggle.classList.add('collapsed');
        }
    }

    // Save trades to localStorage
    function saveTrades() {
        localStorage.setItem('trades', JSON.stringify(trades));
        updateTradeCount();
    }

    // Calculate profit/loss for a trade
    function calculatePL(trade) {
        const priceDifference = trade.positionType === 'buy'
            ? trade.exitPrice - trade.entryPrice
            : trade.entryPrice - trade.exitPrice;

        let pipValue, contractSize;

        // Determine pip value and contract size based on instrument
        if (trade.instrument.includes('JPY')) {
            // JPY pairs (1 pip = 0.01)
            pipValue = 1000; // 0.01 * 100,000 / 100 (since JPY is quote currency)
            contractSize = 100000;
        } else if (trade.instrument.match(/XAU|XAG|OIL|CRUDE|GOLD|SILVER/i)) {
            // Commodities (1 pip = 0.01 typically)
            pipValue = 10; // For commodities, pip value is often $10 per standard lot
            contractSize = 100;
        } else {
            // Forex pairs (1 pip = 0.0001 for most pairs)
            pipValue = 10; // 0.0001 * 100,000
            contractSize = 100000;
        }

        // Calculate pips
        const pips = priceDifference * (trade.instrument.includes('JPY') ? 100 : 10000);

        // Calculate monetary value
        const profitLoss = priceDifference * contractSize * trade.lotSize;

        // For commodities, adjust calculation
        if (trade.instrument.match(/XAU|XAG|OIL|CRUDE|GOLD|SILVER/i)) {
            const profitLoss = priceDifference * trade.lotSize * 100; // Typically $1 per 0.01 move per ounce
        }

        return {
            pips: pips,
            monetary: profitLoss
        };
    }

    // Format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'ZAR'
        }).format(amount);
    }

    // Update trade count display
    function updateTradeCount() {
        const filteredTrades = document.querySelectorAll('#tradeTableBody tr:not([style*="display: none"])');
        const filteredCount = filteredTrades.length;

        tradeCountEl.textContent = `${filteredCount} ${filteredCount === 1 ? 'trade' : 'trades'}`;

        if (filteredCount === 0) {
            emptyStateEl.style.display = 'block';
        } else {
            emptyStateEl.style.display = 'none';
        }
    }

    // Sort trades based on current sort configuration
    function sortTrades(tradesToSort) {
        return [...tradesToSort].sort((a, b) => {
            const aValue = getSortValue(a, sortConfig.key);
            const bValue = getSortValue(b, sortConfig.key);

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    // Get sort value for a trade based on sort key
    function getSortValue(trade, key) {
        switch (key) {
            case 'datetime':
                return new Date(trade.tradeDate + 'T' + trade.tradeTime);
            case 'account':
                return trade.accountType;
            case 'instrument':
                return trade.instrument;
            case 'position':
                return trade.positionType;
            case 'entry':
                return trade.entryPrice;
            case 'exit':
                return trade.exitPrice;
            case 'profit':
                return trade.profitLoss;
            default:
                return '';
        }
    }

    // Update sort indicators in table headers
    function updateSortIndicators() {
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('asc', 'desc');
            if (header.dataset.sort === sortConfig.key) {
                header.classList.add(sortConfig.direction);
            }
        });
    }

    // Render trades in the table
    // Render trades in the table
    function renderTrades(filteredTrades = null) {
        const tradesToRender = filteredTrades || trades;
        tradeTableBody.innerHTML = '';

        // Filter by current view if no filtered trades provided
        const finalTrades = filteredTrades || tradesToRender.filter(trade =>
            currentView === 'all' ||
            (currentView === 'real' && trade.accountType === 'real') ||
            (currentView === 'demo' && trade.accountType === 'demo')
        );

        if (finalTrades.length === 0) {
            emptyStateEl.style.display = 'block';
        } else {
            emptyStateEl.style.display = 'none';
        }

        // Sort trades
        const sortedTrades = sortTrades(finalTrades);

        // Virtual rendering - only render visible trades
        sortedTrades.forEach(trade => {
            const pl = calculatePL(trade);
            const row = document.createElement('tr');
            row.classList.add(trade.accountType === 'real' ? 'real-account' : 'demo-account');

            row.innerHTML = `
                    <td>${formatDate(trade.tradeDate)} ${trade.tradeTime}</td>
                    <td>${trade.accountType === 'real' ? 'Real' : 'Demo'}</td>
                    <td>${trade.instrument}</td>
                    <td>${trade.positionType === 'buy' ? 'Buy' : 'Sell'}</td>
                    <td>${trade.entryPrice.toFixed(5)}</td>
                    <td>${trade.exitPrice.toFixed(5)}</td>
                    <td class="${getOutcomeClass(trade.outcome)}">
                        <span class="outcome-indicator outcome-${trade.outcome}"></span>
                        ${formatCurrency(trade.profitLoss)}
                    </td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${trade.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" data-id="${trade.id}" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;

            tradeTableBody.appendChild(row);
        });

        // Add event listeners to edit and delete buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
        });

        updateStats(); // Update the stats including the trade count
        updateTradeCount(); // This updates the filtered trade count in the table header
    }

    function renderDeposits() {
        depositTableBody.innerHTML = '';

        // Filter by current view
        const filteredDeposits = deposits.filter(deposit =>
            currentView === 'all' ||
            (currentView === 'real' && deposit.accountType === 'real') ||
            (currentView === 'demo' && deposit.accountType === 'demo')
        );

        // Sort by date (newest first)
        const sortedDeposits = [...filteredDeposits].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        sortedDeposits.forEach(deposit => {
            const row = document.createElement('tr');
            row.classList.add(deposit.accountType === 'real' ? 'real-account' : 'demo-account');

            row.innerHTML = `
            <td>${formatDate(deposit.date)}</td>
            <td>${deposit.accountType === 'real' ? 'Real' : 'Demo'}</td>
            <td>${formatCurrency(deposit.amount)}</td>
            <td class="deposit-actions">
                <button class="action-btn delete-deposit-btn" data-id="${deposit.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

            depositTableBody.appendChild(row);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-deposit-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteDeposit(btn.dataset.id));
        });
    }

    // Add a new deposit
    function addDeposit() {
        const amount = parseFloat(depositAmount.value);
        const accountType = depositAccount.value;

        if (!amount || amount <= 0) {
            alert('Please enter a valid deposit amount');
            return;
        }

        const newDeposit = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            amount: amount,
            accountType: accountType
        };

        deposits.push(newDeposit);
        saveDeposits();
        renderDeposits();
        updateStats();

        // Reset form
        depositAmount.value = '';
    }

    // Delete a deposit
    function deleteDeposit(depositId) {
        if (confirm('Are you sure you want to delete this deposit?')) {
            deposits = deposits.filter(deposit => deposit.id !== depositId);
            saveDeposits();
            renderDeposits();
            updateStats();
        }
    }

    // Format date for display
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    // Helper function to get outcome class
    function getOutcomeClass(outcome) {
        switch (outcome) {
            case 'win': return 'win';
            case 'loss': return 'loss';
            case 'breakeven': return 'breakeven';
            default: return '';
        }
    }

    // Update statistics
    function updateStats() {
        const realTrades = trades.filter(trade => trade.accountType === 'real');
        const demoTrades = trades.filter(trade => trade.accountType === 'demo');

        // Calculate total deposits
        const realDeposits = deposits.filter(deposit => deposit.accountType === 'real')
            .reduce((sum, deposit) => sum + deposit.amount, 0);
        const demoDeposits = deposits.filter(deposit => deposit.accountType === 'demo')
            .reduce((sum, deposit) => sum + deposit.amount, 0);

        // Calculate total profit/loss
        const realProfit = realTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
        const demoProfit = demoTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

        // Calculate account balances (deposits + P/L)
        const realBalance = realDeposits + realProfit;
        const demoBalance = demoDeposits + demoProfit;

        realProfitEl.textContent = formatCurrency(realBalance);
        demoProfitEl.textContent = formatCurrency(demoBalance);

        // Calculate win rate - we'll keep this for all trades combined
        const winningTrades = trades.filter(trade => trade.outcome === 'win').length;
        const winRate = trades.length > 0 ? Math.round((winningTrades / trades.length) * 100) : 0;
        winRateEl.textContent = `${winRate}%`;

        // Update total trades based on current view
        if (currentView === 'real') {
            totalTradesEl.textContent = realTrades.length;
        } else if (currentView === 'demo') {
            totalTradesEl.textContent = demoTrades.length;
        } else {
            totalTradesEl.textContent = trades.length; // For 'all' view if you add it later
        }
    }

    // Update chart
    function updateChart() {
        // Group trades by date and account type
        const dateMap = {};

        trades.forEach(trade => {
            const date = trade.tradeDate;
            if (!dateMap[date]) {
                dateMap[date] = { real: 0, demo: 0 };
            }

            const pl = trade.profitLoss;
            if (trade.accountType === 'real') {
                dateMap[date].real += pl;
            } else {
                dateMap[date].demo += pl;
            }
        });

        // Sort dates chronologically
        const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a) - new Date(b));

        // Calculate cumulative P/L
        let realCumulative = 0;
        let demoCumulative = 0;

        const realData = [];
        const demoData = [];

        sortedDates.forEach(date => {
            realCumulative += dateMap[date].real;
            demoCumulative += dateMap[date].demo;

            realData.push(realCumulative);
            demoData.push(demoCumulative);
        });

        // Update chart
        profitChart.data.labels = sortedDates;
        profitChart.data.datasets[0].data = realData;
        profitChart.data.datasets[1].data = demoData;
        profitChart.update();
    }

    // Populate instrument filter dropdown
    function populateInstrumentFilter() {
        const instruments = new Set();
        trades.forEach(trade => instruments.add(trade.instrument));

        filterInstrument.innerHTML = '<option value="all">All Instruments</option>';
        instruments.forEach(instrument => {
            const option = document.createElement('option');
            option.value = instrument;
            option.textContent = instrument;
            filterInstrument.appendChild(option);
        });
    }

    // Filter trades based on filter criteria
    function filterTrades() {
        const accountFilter = filterAccount.value;
        const instrumentFilter = filterInstrument.value;
        const dateFrom = filterDateFrom.value;
        const dateTo = filterDateTo.value;

        let filtered = trades;

        // Apply account filter
        if (accountFilter !== 'all') {
            filtered = filtered.filter(trade => trade.accountType === accountFilter);
        }

        // Apply instrument filter
        if (instrumentFilter !== 'all') {
            filtered = filtered.filter(trade => trade.instrument === instrumentFilter);
        }

        // Apply date filter
        if (dateFrom) {
            filtered = filtered.filter(trade => trade.tradeDate >= dateFrom);
        }

        if (dateTo) {
            filtered = filtered.filter(trade => trade.tradeDate <= dateTo);
        }

        renderTrades(filtered);
    }

    // Open edit modal with trade data
    function openEditModal(tradeId) {
        const trade = trades.find(t => t.id === tradeId);
        if (!trade) return;

        currentEditId = tradeId;

        // Create form fields for editing
        editTradeForm.innerHTML = `
                    <div class="form-group">
                        <label for="editAccountType">Account Type:</label>
                        <select id="editAccountType" required>
                            <option value="real" ${trade.accountType === 'real' ? 'selected' : ''}>Real Account</option>
                            <option value="demo" ${trade.accountType === 'demo' ? 'selected' : ''}>Demo Account</option>
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editTradeDate">Trade Date:</label>
                            <input type="date" id="editTradeDate" value="${trade.tradeDate}" required>
                        </div>
                        <div class="form-group">
                            <label for="editTradeTime">Trade Time:</label>
                            <input type="time" id="editTradeTime" value="${trade.tradeTime}" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="editInstrument">Instrument/Asset:</label>
                        <input type="text" id="editInstrument" value="${trade.instrument}" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editEntryPrice">Entry Price:</label>
                            <input type="number" id="editEntryPrice" value="${trade.entryPrice}" step="0.00001" required>
                        </div>
                        <div class="form-group">
                            <label for="editExitPrice">Exit Price:</label>
                            <input type="number" id="editExitPrice" value="${trade.exitPrice}" step="0.00001" required>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editStopLoss">Stop Loss (SL):</label>
                            <input type="number" id="editStopLoss" value="${trade.stopLoss || ''}" step="0.00001">
                        </div>
                        <div class="form-group">
                            <label for="editTakeProfit">Take Profit (TP):</label>
                            <input type="number" id="editTakeProfit" value="${trade.takeProfit || ''}" step="0.00001">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editLotSize">Lot Size/Volume:</label>
                            <input type="number" id="editLotSize" value="${trade.lotSize}" step="0.01" required>
                        </div>
                        <div class="form-group">
    <label for="editProfitLoss">Profit/Loss (R):</label>
    <input type="number" id="editProfitLoss" value="${trade.profitLoss}" step="0.01" min="-10000000" required>
</div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editPositionType">Position Type:</label>
                            <select id="editPositionType" required>
                                <option value="buy" ${trade.positionType === 'buy' ? 'selected' : ''}>Buy/Long</option>
                                <option value="sell" ${trade.positionType === 'sell' ? 'selected' : ''}>Sell/Short</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editOutcome">Trade Outcome:</label>
                            <select id="editOutcome" required>
                                <option value="win" ${trade.outcome === 'win' ? 'selected' : ''}>Win (TP Hit)</option>
                                <option value="loss" ${trade.outcome === 'loss' ? 'selected' : ''}>Loss (SL Hit)</option>
                                <option value="breakeven" ${trade.outcome === 'breakeven' ? 'selected' : ''}>Breakeven</option>
                                <option value="other" ${trade.outcome === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="editReason">Reason for Trade:</label>
                        <textarea id="editReason" rows="3" required>${trade.reason}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="editNotes">Notes/Lessons Learned:</label>
                        <textarea id="editNotes" rows="3">${trade.notes || ''}</textarea>
                    </div>
                `;

        // Initialize date picker for edit modal
        flatpickr("#editTradeDate", {
            defaultDate: trade.tradeDate,
            maxDate: "today"
        });

        editModal.style.display = 'block';
    }

    // Update trade
    function updateTrade() {
        const tradeIndex = trades.findIndex(t => t.id === currentEditId);
        if (tradeIndex === -1) return;

        trades[tradeIndex] = {
            id: currentEditId,
            accountType: document.getElementById('editAccountType').value,
            tradeDate: document.getElementById('editTradeDate').value,
            tradeTime: document.getElementById('editTradeTime').value,
            instrument: document.getElementById('editInstrument').value,
            entryPrice: parseFloat(document.getElementById('editEntryPrice').value),
            exitPrice: parseFloat(document.getElementById('editExitPrice').value),
            stopLoss: document.getElementById('editStopLoss').value ? parseFloat(document.getElementById('editStopLoss').value) : null,
            takeProfit: document.getElementById('editTakeProfit').value ? parseFloat(document.getElementById('editTakeProfit').value) : null,
            lotSize: parseFloat(document.getElementById('editLotSize').value),
            profitLoss: parseFloat(document.getElementById('editProfitLoss').value),
            positionType: document.getElementById('editPositionType').value,
            outcome: document.getElementById('editOutcome').value,
            reason: document.getElementById('editReason').value,
            notes: document.getElementById('editNotes').value
        };

        saveTrades();
        renderTrades();
        updateStats();
        updateChart();
        populateInstrumentFilter();
        editModal.style.display = 'none';
    }

    // Show delete confirmation modal
    function showDeleteModal(tradeId) {
        currentEditId = tradeId;
        deleteModal.style.display = 'block';
    }

    // Delete trade
    function deleteTrade() {
        trades = trades.filter(trade => trade.id !== currentEditId);
        saveTrades();
        renderTrades();
        updateStats();
        updateChart();
        populateInstrumentFilter();
        deleteModal.style.display = 'none';

        if (editModal.style.display === 'block') {
            editModal.style.display = 'none';
        }
    }

    // Event Listeners
    tradeForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const newTrade = {
            id: Date.now().toString(),
            accountType: document.getElementById('accountType').value,
            tradeDate: document.getElementById('tradeDate').value,
            tradeTime: document.getElementById('tradeTime').value,
            instrument: document.getElementById('instrument').value,
            entryPrice: parseFloat(document.getElementById('entryPrice').value),
            exitPrice: parseFloat(document.getElementById('exitPrice').value),
            stopLoss: document.getElementById('stopLoss').value ? parseFloat(document.getElementById('stopLoss').value) : null,
            takeProfit: document.getElementById('takeProfit').value ? parseFloat(document.getElementById('takeProfit').value) : null,
            lotSize: parseFloat(document.getElementById('lotSize').value),
            profitLoss: parseFloat(document.getElementById('profitLoss').value, // This already handles negatives,
            positionType: document.getElementById('positionType').value,
            outcome: document.getElementById('tradeOutcome').value,
            reason: document.getElementById('reason').value,
            notes: document.getElementById('notes').value
        };

        trades.push(newTrade);
        saveTrades();
        renderTrades();
        updateStats();
        updateChart();
        populateInstrumentFilter();

        // Reset form
        tradeForm.reset();
        document.getElementById('accountType').value = currentView === 'real' ? 'real' : 'demo';
        document.getElementById('tradeDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('tradeTime').value = new Date().toTimeString().substring(0, 5);
    });

    // Account switcher
    realAccountBtn.addEventListener('click', function () {
        currentView = 'real';
        realAccountBtn.classList.add('active');
        demoAccountBtn.classList.remove('active');
        document.getElementById('accountType').value = 'real';
        renderTrades();
        renderDeposits(); // Add this line
        updateStats(); // Explicitly update stats to ensure correct trade count
    });

    demoAccountBtn.addEventListener('click', function () {
        currentView = 'demo';
        demoAccountBtn.classList.add('active');
        realAccountBtn.classList.remove('active');
        document.getElementById('accountType').value = 'demo';
        renderTrades();
        renderDeposits(); // Add this line
        updateStats(); // Explicitly update stats to ensure correct trade count
    });

    // Filter controls
    applyFilters.addEventListener('click', filterTrades);

    resetFilters.addEventListener('click', function () {
        filterAccount.value = 'all';
        filterInstrument.value = 'all';

        const today = new Date().toISOString().split('T')[0];
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        filterDateFrom.value = oneMonthAgo.toISOString().split('T')[0];
        filterDateTo.value = today;

        renderTrades();
    });

    // Table sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;

            if (sortConfig.key === sortKey) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = sortKey;
                sortConfig.direction = 'asc';
            }

            updateSortIndicators();
            renderTrades();
        });
    });

    // Modal controls
    closeModal.forEach(btn => {
        btn.addEventListener('click', function () {
            editModal.style.display = 'none';
            deleteModal.style.display = 'none';
        });
    });

    window.addEventListener('click', function (e) {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
        if (e.target === deleteModal) {
            deleteModal.style.display = 'none';
        }
    });

    updateTradeBtn.addEventListener('click', updateTrade);
    // Deposit button event listener
    addDepositBtn.addEventListener('click', addDeposit);

    confirmDeleteBtn.addEventListener('click', deleteTrade);
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });

    // Mobile collapse toggle
    formToggle.addEventListener('click', function () {
        formCollapse.classList.toggle('collapsed');
        formToggle.classList.toggle('collapsed');
    });

    // Initialize the app
    init();
});
