import { supabase } from './supabase.js';
import { currentUser, reFetchAndRenderCurrentView, showModal, closeModal, showActionSpinner } from './app.js';
import { formatCurrency, getMonthName } from './utils.js';

export async function render(container, selectedMonth) {
    if (!currentUser) return;

    try {
        // --- 1. DATA RE-FETCH PHASE ---
        // A. Fetch Investment Categories
        const { data: categories, error: cErr } = await supabase
            .from('investment_categories')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('name', { ascending: true });
        if (cErr) throw cErr;

        // B. Fetch All Holdings
        const { data: holdings, error: hErr } = await supabase
            .from('holdings')
            .select(`
                *,
                investment_categories (name, is_recurring),
                investment_contributions (amount, month, notes),
                investment_withdrawals (id, amount, date, note)
            `)
            .eq('user_id', currentUser.id)
            .order('name', { ascending: true });
        if (hErr) throw hErr;

        // --- 2. COMPILE ACTIVE PORTFOLIO STATISTICS (All-time scope) ---
        let totalInvestedAllTime = 0;
        let totalCurrentValueAllTime = 0;

        // Segregate holdings
        const activeHoldings = [];
        const closedHoldings = [];

        holdings.forEach(holding => {
            // Process totals
            let invested = 0;
            if (holding.is_recurring) {
                // Sum all contributions made to this historical series
                invested = (holding.investment_contributions || [])
                    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
            } else {
                invested = parseFloat(holding.invested_amount || 0);
            }

            // Proportional reduction for logged withdrawals
            const withdrawalsSum = (holding.investment_withdrawals || [])
                .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

            // Calculate invested after proportional withdrawals
            invested = Math.max(0, invested - withdrawalsSum);

            // Cache computed properties on holding object
            holding.computedInvested = invested;
            holding.computedWithdrawals = withdrawalsSum;

            if (holding.is_closed) {
                closedHoldings.push(holding);
            } else {
                activeHoldings.push(holding);
                
                // Active totals are what we display in dashboard / overview
                // Handle currency display or conversion - if US Funds, convert to INR for global totals? 
                // Spec says: "All other modules use INR. Display currency according to stored investment currency."
                // For global totals, we sum as numeric values. Let's do simple aggregate summing
                totalInvestedAllTime += invested;
                totalCurrentValueAllTime += parseFloat(holding.current_value || 0);
            }
        });

        const totalGainLoss = totalCurrentValueAllTime - totalInvestedAllTime;
        const totalGainPercent = totalInvestedAllTime > 0 ? (totalGainLoss / totalInvestedAllTime) * 100 : 0;

        // --- 3. CALCULATE PENDING CONTRIBUTIONS FOR THE SELECTED MONTH ---
        // A pending contribution exists if an active recurring holding has NO contribution record for selectedMonth
        const pendingSips = [];
        activeHoldings.forEach(holding => {
            if (holding.is_recurring) {
                const hasContributionForMonth = (holding.investment_contributions || [])
                    .some(c => c.month === selectedMonth);
                
                if (!hasContributionForMonth) {
                    pendingSips.push(holding);
                }
            }
        });

        // --- 4. CATEGORY ALLOCATION (for donut chart or breakdown) ---
        const categoryMap = {};
        activeHoldings.forEach(holding => {
            const catName = holding.investment_categories?.name || 'Uncategorized';
            categoryMap[catName] = (categoryMap[catName] || 0) + parseFloat(holding.current_value || 0);
        });

        // --- 5. RENDER PORTFOLIO GRAPHICS ---
        container.innerHTML = `
            <div class="space-y-6">
                <!-- Header Actions -->
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <span class="text-xs uppercase font-semibold text-emerald-600 tracking-wider">ALL-TIME PORTFOLIO</span>
                        <h2 class="text-2xl font-bold tracking-tight text-slate-900">Investments Portfolio</h2>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="btn-manage-inv-categories" class="px-3.5 py-2 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
                            <i data-lucide="settings" class="w-3.5 h-3.5"></i> Categories
                        </button>
                        <button id="btn-add-holding" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer">
                            <i data-lucide="plus" class="w-4 h-4"></i> Create Holding
                        </button>
                    </div>
                </div>

                <!-- Investment Overview Metrics Card -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bento-card p-5">
                        <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Invested</span>
                        <div class="text-lg font-mono font-bold text-slate-900 mt-1">${formatCurrency(totalInvestedAllTime)}</div>
                    </div>
                    <div class="bento-card p-5">
                        <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Current Value</span>
                        <div class="text-lg font-mono font-bold text-slate-950 mt-1">${formatCurrency(totalCurrentValueAllTime)}</div>
                    </div>
                    <div class="bento-card p-5 ${totalGainLoss >= 0 ? 'bg-emerald-50/20' : 'bg-rose-50/20'}">
                        <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Gain / Loss</span>
                        <div class="text-lg font-mono font-bold mt-1 ${totalGainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                            ${totalGainLoss >= 0 ? '+' : ''}${formatCurrency(totalGainLoss)}
                        </div>
                    </div>
                    <div class="bento-card p-5">
                        <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Absolute Returns</span>
                        <div class="text-lg font-mono font-bold mt-1 ${totalGainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                            ${totalGainLoss >= 0 ? '+' : ''}${totalGainPercent.toFixed(1)}%
                        </div>
                    </div>
                </div>

                <!-- Allocation Donut & Pending SIPs Block -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <!-- Allocation Breakdown Chart -->
                    <div class="bento-card p-5 space-y-4">
                        <h3 class="font-bold text-slate-900 text-sm">Asset Classes Allocation</h3>
                        <div class="flex flex-col items-center justify-center pt-2">
                            <div class="relative w-36 h-36 flex items-center justify-center">
                                <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    ${renderAllocationDonut(categoryMap, totalCurrentValueAllTime)}
                                </svg>
                                <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-3 select-none">
                                    <span class="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Wedges</span>
                                    <span class="text-[10px] font-mono font-bold text-slate-800">Class</span>
                                </div>
                            </div>
                            <!-- Category legend list-->
                            <div class="w-full space-y-1.5 mt-4">
                                ${Object.keys(categoryMap).length === 0 ? `
                                    <p class="text-center text-slate-400 text-xs">No active asset allocations.</p>
                                ` : Object.entries(categoryMap).map(([name, val], idx) => {
                                    const pct = totalCurrentValueAllTime > 0 ? (val / totalCurrentValueAllTime) * 100 : 0;
                                    const dotColors = ['bg-emerald-500', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500'];
                                    const color = dotColors[idx % dotColors.length];
                                    return `
                                        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 pb-1 font-mono">
                                            <div class="flex items-center gap-1.5">
                                                <div class="w-2 h-2 rounded-full ${color}"></div>
                                                <span class="font-sans font-medium text-slate-650">${name}</span>
                                            </div>
                                            <div class="font-bold text-slate-800">${formatCurrency(val)} (${pct.toFixed(0)}%)</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Pending SIP confirming Ribbon (Strictly manual confirm before monthly writing!) -->
                    <div class="bento-card p-5 lg:col-span-2 space-y-4 select-none">
                        <div class="border-b border-slate-100 pb-2">
                            <h3 class="font-bold text-slate-900 text-sm">SIP Approvals for ${getMonthName(selectedMonth)}</h3>
                            <p class="text-[10px] text-slate-400">Monthly recurring payments requiring confirmation. Never auto-saved.</p>
                        </div>

                        <div class="space-y-2.5 max-h-[280px] overflow-y-auto">
                            ${pendingSips.length === 0 ? `
                                <div class="py-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                                    <i data-lucide="check-circle-2" class="w-6 h-6 text-emerald-500 mb-2"></i>
                                    All recurring investments and SIP contributions logged for this month!
                                </div>
                            ` : pendingSips.map(sip => `
                                <div class="p-3 bg-amber-50/50 border border-amber-250/50 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                                    <div>
                                        <div class="font-bold text-slate-800 text-xs">${sip.name}</div>
                                        <div class="text-[10px] font-mono text-amber-700 font-semibold mt-0.5">
                                            Amt: ${formatCurrency(sip.monthly_contribution, sip.currency)}
                                        </div>
                                    </div>
                                    <button data-confirm-sip-id="${sip.id}" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold tracking-tight transition-all shadow-md shadow-amber-600/10 cursor-pointer">
                                        Confirm
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                </div>

                <!-- Active Holdings Classified by Type -->
                <div class="space-y-4">
                    <h3 class="font-bold text-slate-900 text-base">Active Assets Ledger</h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${categories.map(cat => {
                            const catHoldings = activeHoldings.filter(h => h.category_id === cat.id);
                            if (catHoldings.length === 0) return ''; // Empty categories hidden for clean bento

                            return `
                                <div class="bento-card p-5 space-y-3">
                                    <div class="flex justify-between items-center border-b border-slate-50 pb-2 select-none">
                                        <h4 class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                            <i data-lucide="folder-open" class="w-3.5 h-3.5 text-emerald-600"></i> ${cat.name}
                                        </h4>
                                        <span class="text-[9px] uppercase tracking-wider font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                            ${catHoldings.length} ${catHoldings.length === 1 ? 'holding' : 'holdings'}
                                        </span>
                                    </div>

                                    <div class="divide-y divide-slate-100">
                                        ${catHoldings.map(h => {
                                            const gain = h.current_value - h.computedInvested;
                                            const gainPct = h.computedInvested > 0 ? (gain / h.computedInvested) * 100 : 0;
                                            
                                            return `
                                                <div class="py-3.5 first:pt-0 last:pb-0 space-y-2">
                                                    <!-- Title & Value summary -->
                                                    <div class="flex justify-between items-start gap-2">
                                                        <div>
                                                            <div class="font-semibold text-slate-800 text-xs leading-none">${h.name}</div>
                                                            ${h.is_recurring ? `
                                                                <span class="text-[9px] text-indigo-600 font-medium font-sans block mt-1">
                                                                    SIP: ${formatCurrency(h.monthly_contribution, h.currency)} / mo
                                                                </span>
                                                            ` : `
                                                                <span class="text-[9px] text-slate-400 block mt-1 font-sans">One-time Principal: ${formatCurrency(h.computedInvested, h.currency)}</span>
                                                            `}
                                                        </div>
                                                        <div class="text-right">
                                                            <div class="text-xs font-mono font-bold text-slate-900">${formatCurrency(h.current_value, h.currency)}</div>
                                                            <span class="text-[10px] font-mono font-bold flex items-center gap-0.5 justify-end mt-0.5 ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}">
                                                                ${gain >= 0 ? '▲' : '▼'} ${gainPct.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <!-- Expand details like Dates or Interest -->
                                                    ${!h.is_recurring && (h.interest_rate || h.maturity_date) ? `
                                                        <div class="bg-slate-50 p-2 rounded-lg grid grid-cols-2 text-[9px] font-mono text-slate-500 gap-1 select-none">
                                                            ${h.interest_rate ? `<span>Rate: <b>${h.interest_rate}%</b></span>` : ''}
                                                            ${h.maturity_date ? `<span>Matures: <b>${h.maturity_date}</b></span>` : ''}
                                                        </div>
                                                    ` : ''}

                                                    <!-- Notes if available -->
                                                    ${h.notes ? `
                                                        <p class="text-[10px] text-slate-400 font-medium italic select-none">"${h.notes}"</p>
                                                    ` : ''}

                                                    <!-- Operations Bar -->
                                                    <div class="flex items-center gap-1 justify-end pt-1 bg-white select-none">
                                                        <button data-update-val-id="${h.id}" class="px-2.5 py-1 text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100 rounded text-[10px] font-bold block transition-all cursor-pointer">
                                                            Update Value
                                                        </button>
                                                        <button data-withdraw-id="${h.id}" class="px-2.5 py-1 text-slate-705 hover:text-orange-700 bg-slate-50 hover:bg-slate-100 rounded text-[10px] font-bold block transition-all cursor-pointer">
                                                            Withdraw
                                                        </button>
                                                        <button data-close-holding-id="${h.id}" class="px-2.5 py-1 text-red-650 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded text-[10px] font-bold block transition-all cursor-pointer">
                                                            Close Holding
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Closed Holdings Ledger (Exclude in sums, but view historical returns) -->
                ${closedHoldings.length === 0 ? '' : `
                    <div class="bento-card p-5 space-y-3 border-l-4 border-l-slate-400 select-none">
                        <div>
                            <h4 class="font-bold text-slate-900 text-sm">Closed Entries History</h4>
                            <p class="text-[10px] text-slate-400">All historical asset accounts permanently closed. Excluded from dynamic summation totals.</p>
                        </div>
                        
                        <div class="divide-y divide-slate-100">
                            ${closedHoldings.map(h => {
                                const returnsGain = parseFloat(h.closure_value || 0) - h.computedInvested;
                                return `
                                    <div class="py-3 flex justify-between items-center text-xs">
                                        <div>
                                            <span class="font-bold text-slate-800">${h.name}</span>
                                            <span class="text-[10px] text-slate-400 block mt-0.5">Closed on ${h.closure_date || ''}</span>
                                        </div>
                                        <div class="text-right font-mono">
                                            <div class="font-bold text-slate-800">Closed value: ${formatCurrency(h.closure_value, h.currency)}</div>
                                            <span class="text-[10px] font-bold ${returnsGain >= 0 ? 'text-emerald-600' : 'text-red-500'}">
                                                Yield: ${returnsGain >= 0 ? '+' : ''}${formatCurrency(returnsGain, h.currency)}
                                            </span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `}

            </div>
        `;

        setupPortfolioListeners(categories, holdings, selectedMonth);

    } catch (e) {
        console.error("Investments view failure:", e);
        container.innerHTML = `<p class="p-6 text-red-500">Failed to render investments view: ${e.message}</p>`;
    }
}

/**
 * Operations listeners triggers
 */
function setupPortfolioListeners(categories, holdings, selectedMonth) {
    // 1. CREATE HOLDING MODAL
    document.getElementById('btn-add-holding').addEventListener('click', () => {
        openHoldingModal(categories);
    });

    // 2. MANAGE CATEGORIES
    document.getElementById('btn-manage-inv-categories').addEventListener('click', () => {
        openCategoriesModal(categories);
    });

    // 3. SIP CONFLICT OVERLAY (MANUAL SUBMIT SIP)
    document.querySelectorAll('[data-confirm-sip-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-confirm-sip-id');
            const holding = holdings.find(h => h.id === id);
            openSipConfirmForm(holding, selectedMonth);
        });
    });

    // 4. VALUE MANUAL MODAL UPDATER
    document.querySelectorAll('[data-update-val-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-update-val-id');
            const holding = holdings.find(h => h.id === id);
            openUpdateValueForm(holding);
        });
    });

    // 5. WITHDRAW FUNDS MODAL UPDATER
    document.querySelectorAll('[data-withdraw-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-withdraw-id');
            const holding = holdings.find(h => h.id === id);
            openWithdrawForm(holding);
        });
    });

    // 6. CLOSE THE HOLDING COMPLETELY
    document.querySelectorAll('[data-close-holding-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-close-holding-id');
            const holding = holdings.find(h => h.id === id);
            openCloseHoldingForm(holding);
        });
    });
}

/**
 * Handle new holdings creation modal
 */
function openHoldingModal(categories) {
    if (categories.length === 0) {
        alert("Please define an investment category first!");
        return;
    }

    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="piggy-bank" class="text-emerald-600"></i> New Asset Holding
            </h3>
            <p class="text-slate-500 text-xs mb-5">Create manual holding logs below. Fields adjust based on category choice.</p>

            <form id="new-holding-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Asset Category</label>
                    <select id="hold-cat-id" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs font-medium">
                        ${categories.map(c => `<option value="${c.id}" data-is-recurring="${c.is_recurring}" data-name="${c.name}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Holding (Asset) Name</label>
                    <input type="text" id="hold-name" required placeholder="E.g., Parag Parikh Flexi Cap, SBI 5Yr FD, SGB 2026 Series I" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>

                <!-- Recurring fields (Displayed if Category is recurring) -->
                <div id="wrapper-recurring-fields" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Monthly Contribution / SIP Amount</label>
                        <input type="number" id="hold-sip" min="0" step="1" value="0" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                    </div>
                </div>

                <!-- One Time fields (Displayed if Category is one-time FD/SGB) -->
                <div id="wrapper-one-time-fields" class="space-y-4 hidden">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Invested Amount (Principal)</label>
                            <input type="number" id="hold-principal" value="0" min="0" step="0.01" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Interest Rate % (Optional)</label>
                            <input type="number" id="hold-rate" placeholder="E.g. 7.1" min="0" step="0.01" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Start / Issue Date</label>
                            <input type="date" id="hold-start" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Maturity Date (Optional)</label>
                            <input type="date" id="hold-end" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                        </div>
                    </div>
                </div>

                <!-- Current Valuation (Manual starting estimate) -->
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Value / Valuation Estimate</label>
                    <input type="number" id="hold-current" required min="0" step="0.01" placeholder="Initial value equivalent" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                </div>

                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Observational Notes</label>
                    <input type="text" id="hold-notes" placeholder="Optional comments on holding parameters" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>

                <div id="usd-flag-wrapper" class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between hidden">
                    <span class="text-xs font-semibold text-indigo-900">US Asset Detected! Convert display values to USD ($)?</span>
                    <span class="text-[9px] uppercase tracking-wider font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full inline-block">USD Enabled</span>
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-hold" class="py-2 border border-slate-200 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Save Asset Asset
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-cancel-hold').addEventListener('click', closeModal);

        const selectCat = document.getElementById('hold-cat-id');
        const recurDiv = document.getElementById('wrapper-recurring-fields');
        const nonRecurDiv = document.getElementById('wrapper-one-time-fields');
        const usdFlag = document.getElementById('usd-flag-wrapper');

        const toggleFields = () => {
            const selectedOpt = selectCat.selectedOptions[0];
            const isRecur = selectedOpt.getAttribute('data-is-recurring') === 'true';
            const name = selectedOpt.getAttribute('data-name');

            if (isRecur) {
                recurDiv.classList.remove('hidden');
                nonRecurDiv.classList.add('hidden');
            } else {
                recurDiv.classList.add('hidden');
                nonRecurDiv.classList.remove('hidden');
            }

            if (name === 'US Funds') {
                usdFlag.classList.remove('hidden');
            } else {
                usdFlag.classList.add('hidden');
            }
        };

        // Attach category adjust
        selectCat.addEventListener('change', toggleFields);
        toggleFields(); // Init setup

        document.getElementById('new-holding-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const categoryId = selectCat.value;
            const selectedOpt = selectCat.selectedOptions[0];
            const isRecur = selectedOpt.getAttribute('data-is-recurring') === 'true';
            const catName = selectedOpt.getAttribute('data-name');

            const name = document.getElementById('hold-name').value;
            const currentVal = parseFloat(document.getElementById('hold-current').value);
            const notes = document.getElementById('hold-notes').value;

            // Recur parameters
            let monthlySip = 0;
            if (isRecur) {
                monthlySip = parseFloat(document.getElementById('hold-sip').value || 0);
            }

            // One-time parameters
            let investedAmt = 0;
            let interestRate = null;
            let startDate = null;
            let maturityDate = null;

            if (!isRecur) {
                investedAmt = parseFloat(document.getElementById('hold-principal').value || 0);
                const rateInput = document.getElementById('hold-rate').value;
                if (rateInput) interestRate = parseFloat(rateInput);
                const startInput = document.getElementById('hold-start').value;
                if (startInput) startDate = startInput;
                const endInput = document.getElementById('hold-end').value;
                if (endInput) maturityDate = endInput;
            }

            const currency = catName === 'US Funds' ? 'USD' : 'INR';

            showActionSpinner(true);
            try {
                const { error } = await supabase
                    .from('holdings')
                    .insert({
                        user_id: currentUser.id,
                        category_id: categoryId,
                        name,
                        is_recurring: isRecur,
                        monthly_contribution: monthlySip,
                        current_value: currentVal,
                        notes,
                        invested_amount: investedAmt,
                        interest_rate: interestRate,
                        start_date: startDate,
                        maturity_date: maturityDate,
                        currency
                    });
                if (error) throw error;
                
                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Insertion failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });
    });
}

/**
 * Handle manual SIP monthly confirmer (pending confirming)
 */
function openSipConfirmForm(holding, selectedMonth) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="check-square" class="text-amber-600"></i> Record SIP Payment
            </h3>
            <p class="text-slate-500 text-xs mb-5">Confirming monthly recurring contribution of <b>${formatCurrency(holding.monthly_contribution, holding.currency)}</b> to holding <b>${holding.name}</b> for ${getMonthName(selectedMonth)}.</p>

            <form id="sip-confirm-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Confirm/Adjust Contribution Amount (${holding.currency})</label>
                    <input type="number" id="sip-confirm-amount" required value="${holding.monthly_contribution}" min="0.01" step="0.01" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Transaction notes / Observational reference</label>
                    <input type="text" id="sip-confirm-note" placeholder="E.g., Logged automatically, salary direct debit" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-sip-modal" class="py-2 border border-slate-200 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium shadow-lg shadow-amber-600/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Confirm Contribution
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-cancel-sip-modal').addEventListener('click', closeModal);

        document.getElementById('sip-confirm-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const finalAmt = parseFloat(document.getElementById('sip-confirm-amount').value);
            const notes = document.getElementById('sip-confirm-note').value;

            showActionSpinner(true);
            try {
                // Post record to investment_contributions
                const { error: insertErr } = await supabase
                    .from('investment_contributions')
                    .insert({
                        user_id: currentUser.id,
                        holding_id: holding.id,
                        month: selectedMonth,
                        amount: finalAmt,
                        notes
                    });
                if (insertErr) throw insertErr;

                // Also proportionally add this to holding's current_value
                const updatedVal = parseFloat(holding.current_value) + finalAmt;
                const { error: updateErr } = await supabase
                    .from('holdings')
                    .update({ current_value: updatedVal })
                    .eq('id', holding.id);
                if (updateErr) throw updateErr;

                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Failed to write contribution: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });
    });
}

/**
 * Update holding's current appraisal value
 */
function openUpdateValueForm(holding) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="edit-3" class="text-emerald-600"></i> Appraise Valuation
            </h3>
            <p class="text-slate-500 text-xs mb-5">Update current market value equivalent for <b>${holding.name}</b>.</p>

            <form id="evaluation-update-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Invested Capital (${holding.currency})</label>
                    <input type="text" disabled value="${formatCurrency(holding.computedInvested, holding.currency)}" class="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono text-xs cursor-not-allowed" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">New Valuation Estimate (${holding.currency})</label>
                    <input type="number" id="eval-up-value" required value="${holding.current_value}" min="0" step="0.01" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-eval" class="py-2 border border-slate-200 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-lg shadow-emerald-6s0/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Update Appraised Value
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-cancel-eval').addEventListener('click', closeModal);

        document.getElementById('evaluation-update-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newVal = parseFloat(document.getElementById('eval-up-value').value);

            showActionSpinner(true);
            try {
                const { error } = await supabase
                    .from('holdings')
                    .update({ current_value: newVal })
                    .eq('id', holding.id);
                if (error) throw error;

                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Appraisal update failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });
    });
}

/**
 * Handle proportional withdrawals action
 */
function openWithdrawForm(holding) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="dollar-sign" class="text-orange-600"></i> Log Withdrawal
            </h3>
            <p class="text-slate-500 text-xs mb-5">Withdraw active funds from <b>${holding.name}</b>. This proportionally reduces invested principal and appraisal values altogether.</p>

            <form id="withdrawer-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Valuation Availability (${holding.currency})</label>
                    <input type="text" disabled value="${formatCurrency(holding.current_value, holding.currency)}" class="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono text-xs cursor-not-allowed" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Withdrawal Amount (${holding.currency})</label>
                    <input type="number" id="with-amount" required min="0.01" step="0.01" max="${holding.current_value}" placeholder="Enter amount to liquidate" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Withdrawal Date</label>
                    <input type="date" id="with-date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Transaction observation note</label>
                    <input type="text" id="with-note" placeholder="E.g., Redeemed mutual funds for vacation, etc." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-with" class="py-2 border border-slate-200 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium shadow-lg shadow-orange-600/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Liquidate Funds
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-cancel-with').addEventListener('click', closeModal);

        document.getElementById('withdrawer-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const withAmount = parseFloat(document.getElementById('with-amount').value);
            const withDate = document.getElementById('with-date').value;
            const note = document.getElementById('with-note').value;

            showActionSpinner(true);
            try {
                // Log record first
                const { error: recErr } = await supabase
                    .from('investment_withdrawals')
                    .insert({
                        user_id: currentUser.id,
                        holding_id: holding.id,
                        amount: withAmount,
                        date: withDate,
                        note
                    });
                if (recErr) throw recErr;

                // proportional reducer formula:
                // pRatio = withAmount / holding.current_value
                // reduce current_value directly: current_value - withAmount
                // reduce computed invested proportionally: invested - (pRatio * invested)
                const currentVal = parseFloat(holding.current_value);
                const investedAmt = parseFloat(holding.computedInvested);

                const nextCurrent = Math.max(0, currentVal - withAmount);
                
                let nextInvested = investedAmt;
                if (currentVal > 0) {
                    const ratio = withAmount / currentVal;
                    nextInvested = Math.max(0, investedAmt - (ratio * investedAmt));
                }

                // Push updates to holding
                const { error: updErr } = await supabase
                    .from('holdings')
                    .update({
                        current_value: nextCurrent,
                        invested_amount: nextInvested // Save down to database backing field
                    })
                    .eq('id', holding.id);
                if (updErr) throw updErr;

                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Withdrawal execution failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });
    });
}

/**
 * Handle closed holdings modal actions
 */
function openCloseHoldingForm(holding) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="archive" class="text-red-600"></i> Close Holding Account
            </h3>
            <p class="text-slate-500 text-xs mb-5">Permanently closing <b>${holding.name}</b> moving it to history tracker.</p>

            <form id="closing-acc-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Invested Cost Basis (${holding.currency})</label>
                    <input type="text" disabled value="${formatCurrency(holding.computedInvested, holding.currency)}" class="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono text-xs cursor-not-allowed" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Actual Closure Value / Payout Amount (${holding.currency})</label>
                    <input type="number" id="close-payout" required value="${holding.current_value}" min="0" step="0.01" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Closure Date</label>
                    <input type="date" id="close-date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Closure Narrative / Close Note</label>
                    <input type="text" id="close-note" placeholder="E.g., SGB mature payout, FD term complete, etc." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-close" class="py-2 border border-slate-200 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium shadow-lg shadow-red-600/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="archive" class="w-3.5 h-3.5"></i> Close Account
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-cancel-close').addEventListener('click', closeModal);

        document.getElementById('closing-acc-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payout = parseFloat(document.getElementById('close-payout').value);
            const date = document.getElementById('close-date').value;
            const note = document.getElementById('close-note').value;

            showActionSpinner(true);
            try {
                // Move item status to is_closed
                const { error } = await supabase
                    .from('holdings')
                    .update({
                        is_closed: true,
                        closure_value: payout,
                        closure_date: date,
                        closure_note: note,
                        current_value: 0 // Active evaluation becomes 0
                    })
                    .eq('id', holding.id);
                if (error) throw error;

                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Account closure execution failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });
    });
}

/**
 * Manage categories metadata modal
 */
function openCategoriesModal(categories) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="tag" class="text-emerald-600"></i> Investment Classes
            </h3>
            <p class="text-slate-500 text-xs mb-5">Track custom sub-classes used in your global portfolio allocations.</p>

            <form id="add-inv-cat-form" class="space-y-3 mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Category Name</label>
                        <input type="text" id="new-cat-name" required placeholder="E.g., Real Estate" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                    </div>
                    <div>
                        <label class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Recurring (SIP)?</label>
                        <select id="new-cat-recur" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs">
                            <option value="false">One-Time (FD/SGB)</option>
                            <option value="true">Recurring (SIP)</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="w-full py-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold">Define Category</button>
            </form>

            <div class="max-h-[180px] overflow-y-auto mb-5 border border-slate-100 rounded-lg divide-y divide-slate-100">
                ${categories.map(c => `
                    <div class="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-all text-xs">
                        <div>
                            <span class="font-bold text-slate-800">${c.name}</span>
                            <span class="text-[9px] text-slate-400 block">${c.is_recurring ? 'Recurring SIP schedule' : 'One-time manual purchase'}</span>
                        </div>
                        <button data-del-inv-cat-id="${c.id}" class="text-slate-400 hover:text-red-500 p-1 cursor-pointer">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="flex justify-end">
                <button type="button" id="btn-close-inv-cats" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs cursor-pointer transition-all">Close Panel</button>
            </div>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-close-inv-cats').addEventListener('click', closeModal);

        document.getElementById('add-inv-cat-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-cat-name').value;
            const isRecur = document.getElementById('new-cat-recur').value === 'true';

            showActionSpinner(true);
            try {
                const { error } = await supabase
                    .from('investment_categories')
                    .insert({ user_id: currentUser.id, name, is_recurring: isRecur });
                if (error) throw error;
                
                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Creation failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });

        document.querySelectorAll('[data-del-inv-cat-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-del-inv-cat-id');
                if (confirm("Deleting this category cascades and deletes all manual holdings registered inside it. Continue?")) {
                    showActionSpinner(true);
                    try {
                        const { error } = await supabase
                            .from('investment_categories')
                            .delete()
                            .eq('id', id);
                        if (error) throw error;
                        
                        closeModal();
                        await reFetchAndRenderCurrentView();
                    } catch (err) {
                        alert("Delete failed: " + err.message);
                    } finally {
                        showActionSpinner(false);
                    }
                }
            });
        });
    });
}

/**
 * Clean inline relative allocation donut chart
 */
function renderAllocationDonut(categoryMap, total) {
    if (total === 0) {
        return `<circle cx="50" cy="50" r="35" fill="none" stroke="#e2e8f0" stroke-width="12" />`;
    }

    const items = Object.entries(categoryMap);
    let accumulatedPercentage = 0;
    const slicesHTML = [];

    const colors = ['#10b981', '#6366f1', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];

    items.forEach(([name, val], idx) => {
        const floatVal = parseFloat(val);
        if (floatVal <= 0) return;

        const percentage = (floatVal / total) * 100;
        const strokeDash = `${percentage} ${100 - percentage}`;
        const strokeOffset = 100 - accumulatedPercentage;
        const color = colors[idx % colors.length];

        slicesHTML.push(`
            <circle cx="50" cy="50" r="35" fill="none" 
                    stroke="${color}" 
                    stroke-width="12" 
                    stroke-dasharray="${strokeDash}" 
                    stroke-dashoffset="${strokeOffset}" 
                    stroke-linecap="round"
                    class="transition-all origin-center hover:scale-[1.03]" />
        `);

        accumulatedPercentage += percentage;
    });

    return slicesHTML.join('');
}
