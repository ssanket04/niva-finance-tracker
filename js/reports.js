import { supabase } from './supabase.js';
import { currentUser } from './app.js';
import { formatCurrency, getPrevMonth, getMonthName, escapeHTML } from './utils.js';

export async function render(container, selectedMonth) {
    if (!currentUser) return;

    try {
        // --- 1. DATA RE-FETCH PHASE — Fetch all 8 queries in parallel via Promise.all ---
        const prevMonth = getPrevMonth(selectedMonth);

        const [
            { data: incomes, error: incErr },
            { data: expenses, error: expErr },
            { data: contributions, error: contrErr },
            { data: bankLedgers, error: bankErr },
            { data: activeHoldings, error: holdErr },
            { data: prevIncomes },
            { data: prevExpenses },
            { data: prevContrs }
        ] = await Promise.all([
            // A. Income entries for selected month
            supabase.from('income_entries').select('amount, date_credited, note, income_sources (name)')
                .eq('user_id', currentUser.id).eq('month', selectedMonth),
            // B. Expense entries for selected month
            supabase.from('expense_entries').select('amount, category_id, date, note, expense_categories (name)')
                .eq('user_id', currentUser.id).eq('month', selectedMonth),
            // C. Investment Contributions (SIPs Confirmed) for selected month
            supabase.from('investment_contributions').select('amount, holding_id, holdings (name, is_recurring)')
                .eq('user_id', currentUser.id).eq('month', selectedMonth),
            // D. Bank Balances (Opening, Closing, Net changes) for selected month
            supabase.from('bank_balances').select('opening_balance, closing_balance, note, bank_accounts (bank_name, account_number)')
                .eq('user_id', currentUser.id).eq('month', selectedMonth),
            // E. Holdings totals for investment snapshot
            supabase.from('holdings').select('id, invested_amount, current_value, is_recurring, investment_contributions (amount), investment_withdrawals (amount)')
                .eq('user_id', currentUser.id).eq('is_closed', false),
            // F. Prev month income (for MoM comparison)
            supabase.from('income_entries').select('amount')
                .eq('user_id', currentUser.id).eq('month', prevMonth),
            // G. Prev month expenses (for MoM comparison)
            supabase.from('expense_entries').select('amount')
                .eq('user_id', currentUser.id).eq('month', prevMonth),
            // H. Prev month investment contributions
            supabase.from('investment_contributions').select('amount')
                .eq('user_id', currentUser.id).eq('month', prevMonth)
        ]);

        if (incErr) throw incErr;
        if (expErr) throw expErr;
        if (contrErr) throw contrErr;
        if (bankErr) throw bankErr;
        if (holdErr) throw holdErr;

        const totalIncome = incomes.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const totalContributions = contributions.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        let totalInvestedActive = 0;
        let totalCurrentValueActive = 0;
        activeHoldings.forEach(holding => {
            let invested = holding.is_recurring
                ? (holding.investment_contributions || []).reduce((sum, c) => sum + parseFloat(c.amount), 0)
                : parseFloat(holding.invested_amount || 0);
            const withdrawalsSum = (holding.investment_withdrawals || []).reduce((sum, w) => sum + parseFloat(w.amount), 0);
            invested = Math.max(0, invested - withdrawalsSum);
            totalInvestedActive += invested;
            totalCurrentValueActive += parseFloat(holding.current_value || 0);
        });

        const prevTotalIncome = (prevIncomes || []).reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const prevTotalExpenses = (prevExpenses || []).reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const prevTotalContributions = (prevContrs || []).reduce((sum, item) => sum + parseFloat(item.amount), 0);

        // --- 2. REPORTS CALCULATIONS ---
        // Savings = Income − Expenses − Investment Contributions
        const savings = totalIncome - totalExpenses - totalContributions;
        const savingsRate = totalIncome > 0 ? (((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

        const prevSavings = prevTotalIncome - prevTotalExpenses - prevTotalContributions;

        // MoM changes percentages
        const incPct = prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : 0;
        const expPct = prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 : 0;
        const savPct = prevSavings !== 0 ? ((savings - prevSavings) / Math.abs(prevSavings)) * 100 : 0;

        // Compile category spending aggregates for table
        const expenseCategoryAgg = {};
        expenses.forEach(e => {
            const name = e.expense_categories?.name || 'Uncategorized';
            expenseCategoryAgg[name] = (expenseCategoryAgg[name] || 0) + parseFloat(e.amount);
        });

        // Generate insights array (Rule-based conditions)
        const insights = [];
        
        if (totalExpenses > totalIncome && totalIncome > 0) {
            insights.push({
                type: 'warning',
                text: "Expenses exceeded income this month. Keep track of discretionary credit lines.",
                icon: 'alert-triangle'
            });
        }

        if (savingsRate > 30) {
            insights.push({
                type: 'success',
                text: `Strong savings rate of <b>${savingsRate.toFixed(0)}%</b>! You are outperforming standard models.`,
                icon: 'thumbs-up'
            });
        } else if (totalIncome > 0 && savingsRate < 10) {
            insights.push({
                type: 'neutral',
                text: "Savings rate is below 10% this month. Try tracking discretionary expenditure items.",
                icon: 'activity'
            });
        }

        // Highest expense category index
        let topCatName = '';
        let topCatAmt = 0;
        Object.entries(expenseCategoryAgg).forEach(([name, amt]) => {
            if (amt > topCatAmt) {
                topCatAmt = amt;
                topCatName = name;
            }
        });

        if (topCatAmt > 0) {
            insights.push({
                type: 'neutral',
                text: `Highest expense category: <b>${escapeHTML(topCatName)}</b> with a total spend of <b>${formatCurrency(topCatAmt)}</b>.`,
                icon: 'arrow-right-circle'
            });
        }

        // Check if all recurring investments are confirmed
        const totalRecurringHoldingsCount = activeHoldings.filter(h => h.is_recurring).length;
        const confirmedHoldingsCountThisMonth = contributions.filter(c => c.holdings?.is_recurring).length;

        if (totalRecurringHoldingsCount > 0 && confirmedHoldingsCountThisMonth >= totalRecurringHoldingsCount) {
            insights.push({
                type: 'success',
                text: "All recurring investments logged this month.",
                icon: 'check-check'
            });
        }

        // --- 3. RENDER STAGE-SPECIFIC REPORT LAYOUT ---
        container.innerHTML = `
            <div class="space-y-6">
                <!-- Header Titles -->
                <div>
                    <span class="text-xs uppercase font-semibold text-emerald-600 tracking-wider">MONTHLY LEDGER STATS</span>
                    <h2 class="text-2xl font-bold tracking-tight text-slate-900">Reports Analysis</h2>
                    <p class="text-[10px] text-slate-400 mt-0.5">Aggregated finance snapshot scoped to ${getMonthName(selectedMonth)}</p>
                </div>

                <!-- Reports Month Summary Metrics List -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <div class="bento-card p-4">
                        <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Total Income</span>
                        <span class="font-mono font-bold text-slate-805 text-base">${formatCurrency(totalIncome)}</span>
                    </div>
                    <div class="bento-card p-4">
                        <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Total Expenses</span>
                        <span class="font-mono font-bold text-rose-500 text-base">${formatCurrency(totalExpenses)}</span>
                    </div>
                    <div class="bento-card p-4">
                        <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">SIP Contributions</span>
                        <span class="font-mono font-bold text-indigo-600 text-base">${formatCurrency(totalContributions)}</span>
                    </div>
                    <div class="bento-card p-4 bg-emerald-500/[0.03]">
                        <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Unallocated Cash</span>
                        <span class="font-mono font-bold text-slate-900 text-base">${formatCurrency(savings)}</span>
                    </div>
                    <div class="bento-card p-4 bg-emerald-500/[0.03]">
                        <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">Savings Rate</span>
                        <span class="font-mono font-bold text-emerald-600 text-base">${savingsRate.toFixed(0)}%</span>
                    </div>
                </div>

                <!-- Simple Rule-Based Insights Box (No AI) -->
                ${insights.length === 0 ? '' : `
                    <div class="bento-card p-5 space-y-3.5 border-l-4 border-l-emerald-500 bg-white select-none">
                        <h4 class="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                            <i data-lucide="sparkles" class="w-4 h-4 text-emerald-600"></i> Rules-Based Audit Insights
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                            ${insights.map(item => {
                                const isWarning = item.type === 'warning';
                                const isSuccess = item.type === 'success';
                                const badgeColor = isWarning ? 'bg-rose-50 text-rose-700' : isSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700';

                                return `
                                    <div class="flex items-start gap-2.5 p-3 rounded-xl border border-dotted border-slate-100">
                                        <div class="p-1 px-1.5 rounded-lg ${badgeColor} shrink-0">
                                            <i data-lucide="${item.icon}" class="w-3.5 h-3.5"></i>
                                        </div>
                                        <p class="text-[11px] text-slate-650 leading-relaxed font-sans">${item.text}</p>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `}

                <!-- Table grids: Income & Expenses side-by-side -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    <!-- Month Income Breakdowns Table -->
                    <div class="bento-card overflow-hidden">
                        <div class="p-4 border-b border-slate-50 bg-slate-50/50">
                            <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">Incomes Ledger</h4>
                        </div>
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="bg-slate-50/20 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th class="p-3">Source Name</th>
                                    <th class="p-3">Date</th>
                                    <th class="p-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-150">
                                 ${incomes.length === 0 ? `
                                     <tr>
                                         <td colspan="3" class="p-6 text-center text-slate-400">
                                             <p class="font-medium text-slate-500 text-xs">No income entries logged this month.</p>
                                             <p class="text-[10px] text-slate-400 mt-1">Log credits in the Income workspace to view reports here.</p>
                                         </td>
                                     </tr>
                                ` : incomes.map(item => `
                                    <tr class="hover:bg-slate-50/30 transition-all">
                                        <td class="p-3 font-semibold text-slate-800">${escapeHTML(item.income_sources?.name || 'Unassigned')}</td>
                                        <td class="p-3 font-mono text-slate-450">${item.date_credited}</td>
                                        <td class="p-3 font-mono text-right font-bold text-emerald-600">${formatCurrency(item.amount)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Month Expenses Breakdowns Percentage Table -->
                    <div class="bento-card overflow-hidden">
                        <div class="p-4 border-b border-slate-50 bg-slate-50/50">
                            <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">Expense Classes Breakdown</h4>
                        </div>
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="bg-slate-50/20 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th class="p-3">Category Class</th>
                                    <th class="p-3">Relative Weight %</th>
                                    <th class="p-3 text-right">Amount Outlay</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-150">
                                 ${Object.keys(expenseCategoryAgg).length === 0 ? `
                                     <tr>
                                         <td colspan="3" class="p-6 text-center text-slate-400">
                                             <p class="font-medium text-slate-500 text-xs">No expense entries logged this month.</p>
                                             <p class="text-[10px] text-slate-400 mt-1">Record outflows in the Expenses workspace to view breakdowns.</p>
                                         </td>
                                     </tr>
                                ` : Object.entries(expenseCategoryAgg).map(([name, sum]) => {
                                    const percentageVal = totalExpenses > 0 ? (sum / totalExpenses) * 100 : 0;
                                    return `
                                        <tr class="hover:bg-slate-50/30 transition-all font-mono">
                                            <td class="p-3 font-sans font-semibold text-slate-800">${escapeHTML(name)}</td>
                                            <td class="p-3 text-slate-500 font-bold">${percentageVal.toFixed(0)}%</td>
                                            <td class="p-3 text-right font-bold text-rose-500">${formatCurrency(sum)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                </div>

                <!-- Table grids: Bank ledgers & Investment snapshot -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    <!-- Bank state balances snapshot -->
                    <div class="bento-card overflow-hidden">
                        <div class="p-4 border-b border-slate-50 bg-slate-50/50">
                            <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">Active Banks Snapshot</h4>
                        </div>
                        <table class="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                                <tr class="bg-slate-50/20 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th class="p-3 font-sans">Bank Account</th>
                                    <th class="p-3">Opening</th>
                                    <th class="p-3">Closing</th>
                                    <th class="p-3 text-right">Net Change</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-150">
                                 ${bankLedgers.length === 0 ? `
                                     <tr>
                                         <td colspan="4" class="p-6 text-center text-slate-400 font-sans">
                                             <p class="font-medium text-slate-500 text-xs">No balance ledgers logged for ${getMonthName(selectedMonth)} yet.</p>
                                             <p class="text-[10px] text-slate-400 mt-1">Update closing cash levels in the Banks tab to compile ledger shifts.</p>
                                         </td>
                                     </tr>
                                ` : bankLedgers.map(item => {
                                    const netChange = parseFloat(item.closing_balance || 0) - parseFloat(item.opening_balance || 0);

                                    return `
                                        <tr class="hover:bg-slate-50/30 transition-all">
                                            <td class="p-3 font-sans font-semibold text-slate-800">
                                                ${escapeHTML(item.bank_accounts?.bank_name || 'Unlinked Bank')}
                                                <span class="block font-mono text-[9px] text-slate-400 font-normal mt-0.5">No: ${escapeHTML(item.bank_accounts?.account_number || '—')}</span>
                                            </td>
                                            <td class="p-3 text-slate-650">${formatCurrency(item.opening_balance)}</td>
                                            <td class="p-3 font-bold text-slate-900">${formatCurrency(item.closing_balance)}</td>
                                            <td class="p-3 text-right font-bold ${netChange >= 0 ? 'text-emerald-600' : 'text-rose-500'}">
                                                ${netChange >= 0 ? '+' : ''}${formatCurrency(netChange)}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Investment summary snapshots -->
                    <div class="bento-card p-5 space-y-4 flex flex-col justify-between">
                        <div>
                            <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider pb-2 border-b border-slate-50 select-none">Portfolio Summary Snapshot</h4>
                            <p class="text-[10px] text-slate-400 pt-1 leading-snug">Continuous appraisal indicators across all active holdings (all-time portfolio state metrics reflected).</p>
                        </div>

                        <div class="grid grid-cols-3 gap-3.5 py-4 border-y border-dashed border-slate-100 font-mono select-none">
                            <div>
                                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Principal Invested</span>
                                <span class="text-xs font-bold text-slate-700 block">${formatCurrency(totalInvestedActive)}</span>
                            </div>
                            <div class="border-l border-slate-100 pl-3">
                                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Current Value</span>
                                <span class="text-xs font-bold text-slate-950 block">${formatCurrency(totalCurrentValueActive)}</span>
                            </div>
                            <div class="border-l border-slate-100 pl-3">
                                <span class="text-[8px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Asset returns</span>
                                <span class="text-xs font-bold block ${totalCurrentValueActive - totalInvestedActive >= 0 ? 'text-emerald-600' : 'text-rose-500'}">
                                    ${totalCurrentValueActive - totalInvestedActive >= 0 ? '+' : ''}${formatCurrency(totalCurrentValueActive - totalInvestedActive)}
                                </span>
                            </div>
                        </div>

                        <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between select-none">
                            <span class="text-xs font-semibold text-slate-655 flex items-center gap-1.5 font-sans">
                                <i data-lucide="info" class="w-4 h-4 text-emerald-600 shrink-0"></i> Agg returns metrics
                            </span>
                            <span class="text-xs font-mono font-bold ${totalCurrentValueActive - totalInvestedActive >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                                ${totalInvestedActive > 0 ? ((totalCurrentValueActive - totalInvestedActive) / totalInvestedActive * 100).toFixed(1) : '0'}% Absolute Yield
                            </span>
                        </div>
                    </div>

                </div>

                <!-- Future Comparing with Previous Month (MoM change matrix sheet) -->
                <div class="bento-card p-5 space-y-4 bg-gradient-to-br from-white to-slate-25 hover:border-slate-350 transition-all select-none">
                    <div>
                        <h4 class="font-bold text-slate-900 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                            <i data-lucide="bar-chart-3" class="w-4 h-4 text-emerald-600"></i> MoM Comparison Matrix
                        </h4>
                        <p class="text-[10px] text-slate-400 leading-tight">Variance review comparing ${getMonthName(selectedMonth)} against ${getMonthName(prevMonth)}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        
                        <div class="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-405 uppercase font-bold tracking-wider">MoM Incomes change</span>
                                <div class="font-mono font-bold text-slate-800 text-sm mt-0.5">${formatCurrency(totalIncome)}</div>
                            </div>
                            <span class="font-semibold text-xs px-2.5 py-1 rounded-full font-mono ${incPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                                ${incPct >= 0 ? '▲ +' : '▼ '}${incPct.toFixed(0)}%
                            </span>
                        </div>

                        <div class="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-405 uppercase font-bold tracking-wider">MoM Outflows change</span>
                                <div class="font-mono font-bold text-slate-800 text-sm mt-0.5">${formatCurrency(totalExpenses)}</div>
                            </div>
                            <span class="font-semibold text-xs px-2.5 py-1 rounded-full font-mono ${expPct <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                                ${expPct >= 0 ? '▲ +' : '▼ '}${expPct.toFixed(0)}%
                            </span>
                        </div>

                        <div class="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-slate-405 uppercase font-bold tracking-wider">MoM Unallocated Cash</span>
                                <div class="font-mono font-bold text-slate-800 text-sm mt-0.5">${formatCurrency(savings)}</div>
                            </div>
                            <span class="font-semibold text-xs px-2.5 py-1 rounded-full font-mono ${savPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                                ${savPct >= 0 ? '▲ +' : '▼ '}${savPct.toFixed(0)}%
                            </span>
                        </div>

                    </div>
                </div>

            </div>
        `;

    } catch (e) {
        console.error("Reports compile failure:", e);
        container.innerHTML = `<p class="p-6 text-red-500">Failed to render financial reports: ${e.message}</p>`;
    }
}
