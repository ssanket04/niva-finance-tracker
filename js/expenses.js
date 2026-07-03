import { supabase } from './supabase.js';
import { currentUser, reFetchAndRenderCurrentView, showModal, closeModal, showActionSpinner } from './app.js';
import { formatCurrency, escapeHTML } from './utils.js';
import { NaiveBayesClassifier } from './classifier.js';

export async function render(container, selectedMonth) {
    if (!currentUser) return;

    try {
        // --- 1. DATA RE-FETCH PHASE ---
        const [
            { data: categories, error: cErr },
            { data: entries, error: eErr },
            { data: trainingData }
        ] = await Promise.all([
            supabase
                .from('expense_categories')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('name', { ascending: true }),
            supabase
                .from('expense_entries')
                .select(`
                    id,
                    amount,
                    date,
                    note,
                    category_id,
                    expense_categories (name)
                `)
                .eq('user_id', currentUser.id)
                .eq('month', selectedMonth)
                .order('date', { ascending: false }),
            supabase
                .from('expense_entries')
                .select('note, category_id, amount')
                .eq('user_id', currentUser.id)
                .order('date', { ascending: false })
                .limit(200)
        ]);
        if (cErr) throw cErr;
        if (eErr) throw eErr;

        const totalExpenses = entries.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        // Train Naive Bayes Categorizer on historical transactions
        const classifier = new NaiveBayesClassifier();
        if (trainingData) {
            trainingData.forEach(e => {
                if (e.note && e.category_id) {
                    classifier.train(e.note, e.category_id);
                }
            });
        }

        // --- 2. RENDER THE INTERACTIVE WORKSPACE ---
        container.innerHTML = `
            <div class="space-y-6">
                <!-- Header Actions -->
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <span class="text-xs uppercase font-semibold text-emerald-600 tracking-wider">MONTHLY EXPENSES LOG</span>
                        <h2 class="text-2xl font-bold tracking-tight text-slate-900">Expenses</h2>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button id="btn-manage-exp-categories" class="px-3 py-2 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
                            <i data-lucide="settings" class="w-3.5 h-3.5"></i> Categories
                        </button>
                        <button id="btn-import-csv" class="px-3 py-2 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
                            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Import CSV
                        </button>
                        <button id="btn-add-expense" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer">
                            <i data-lucide="plus" class="w-4 h-4"></i> Add Entry
                        </button>
                    </div>
                </div>

                <!-- Monthly Total banner -->
                <div class="bento-card p-5 bg-gradient-to-r from-emerald-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-emerald-500 select-none">
                    <div class="flex items-center gap-3">
                        <div class="bg-emerald-100/80 p-2.5 rounded-xl text-emerald-600">
                            <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Monthly Expenditure</span>
                            <div class="text-xs text-slate-650">Sum of cash outflows in selected month</div>
                        </div>
                    </div>
                    <div class="text-left sm:text-right">
                        <span class="text-[10px] text-slate-405 font-medium leading-none block">Aggregate Expenses</span>
                        <span class="text-xl font-mono font-bold text-slate-950">${formatCurrency(totalExpenses)}</span>
                    </div>
                </div>

                <!-- Live Search & Filtering bar -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="relative sm:col-span-2">
                        <input type="text" id="expense-search" placeholder="Search keywords..." class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 outline-none rounded-xl focus:border-emerald-500 text-xs text-slate-800" />
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <i data-lucide="search" class="w-4 h-4"></i>
                        </div>
                    </div>
                    <div>
                        <select id="expense-filter-cat" class="w-full px-3 py-2 bg-white border border-slate-200 outline-none rounded-xl focus:border-emerald-500 text-xs text-slate-700 font-medium font-sans">
                            <option value="ALL">All Categories</option>
                            ${categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Collapsible Categories Summary Breakdown (Requested) -->
                <div class="space-y-3 select-none">
                    <h3 class="font-bold text-slate-900 text-base">Collapsible Category Breakdowns</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${categories.map(cat => {
                            const catEntries = entries.filter(e => e.category_id === cat.id);
                            const catTotal = catEntries.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                            
                            return `
                                <div class="bento-card p-4 space-y-1 hover:border-slate-300 transition-all cursor-pointer" data-collapse-trigger="${cat.id}">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 transition-all transform shrink-0" data-arrow-id="${cat.id}"></i>
                                            <span class="font-bold text-slate-800 text-xs">${escapeHTML(cat.name)}</span>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-mono font-bold text-slate-905 text-xs">${formatCurrency(catTotal)}</div>
                                            <span class="text-[9px] text-slate-400">${catEntries.length} entries</span>
                                        </div>
                                    </div>
                                    
                                    <!-- Collapsed entries log drawer elements -->
                                    <div id="drawer-${cat.id}" class="hidden space-y-1.5 mt-3 pt-2.5 border-t border-slate-150 text-[11px] max-h-[140px] overflow-y-auto">
                                        ${catEntries.length === 0 ? `
                                            <p class="text-slate-400 italic py-1">No items logged in this category.</p>
                                        ` : catEntries.map(e => `
                                            <div class="flex justify-between items-center text-slate-650 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <div>
                                                    <span class="font-medium text-slate-800">${escapeHTML(e.note || 'No note')}</span>
                                                    <span class="block text-[9px] font-mono text-slate-400">${e.date}</span>
                                                </div>
                                                <div class="font-mono font-bold text-slate-800">${formatCurrency(e.amount)}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Primary Newest-First Expense Table List -->
                <div class="bento-card overflow-hidden">
                    <div class="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-705 uppercase tracking-wider">Historical Debit Entries</span>
                        <span class="text-[10px] font-mono text-slate-405">Listed Newest First</span>
                    </div>
                    <table class="w-full text-left border-collapse" id="expense-main-table">
                        <thead>
                            <tr class="bg-slate-50/20 border-b border-slate-100 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                                <th class="p-4">Category</th>
                                <th class="p-4">Amount</th>
                                <th class="p-4 hidden sm:table-cell">Date</th>
                                <th class="p-4 hidden md:table-cell">Memo/Note</th>
                                <th class="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-xs">
                             ${entries.length === 0 ? `
                                 <tr>
                                     <td colspan="5" class="p-8 text-center text-slate-400">
                                         <i data-lucide="inbox" class="w-8 h-8 opacity-40 mx-auto mb-2"></i>
                                         <p class="font-medium text-slate-500 text-xs">No expense entries logged for this month.</p>
                                         <p class="text-[10px] text-slate-400 mt-1">Click <b>'Add Entry'</b> to record your first expense or <b>'Import CSV'</b> to upload bank statements.</p>
                                     </td>
                                 </tr>
                            ` : entries.map(entry => `
                                <tr class="hover:bg-slate-50/50 transition-all expense-row-element" data-cat-id="${entry.category_id}" data-text-note="${escapeHTML((entry.note || '').toLowerCase())}" data-text-amount="${entry.amount}">
                                    <td class="p-4 font-semibold text-slate-800">
                                        ${escapeHTML(entry.expense_categories?.name || 'Uncategorized')}
                                        <span class="block sm:hidden text-[10px] font-mono text-slate-400 leading-none mt-1">${entry.date}</span>
                                    </td>
                                    <td class="p-4 font-mono font-bold text-rose-600">${formatCurrency(entry.amount)}</td>
                                    <td class="p-4 font-mono text-slate-505 hidden sm:table-cell">${entry.date}</td>
                                    <td class="p-4 text-slate-400 hidden md:table-cell max-w-[220px] truncate" title="${escapeHTML(entry.note || '')}">${escapeHTML(entry.note || '—')}</td>
                                    <td class="p-4 text-right">
                                        <div class="inline-flex items-center gap-1">
                                            <button data-edit-expense-id="${entry.id}" class="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100 cursor-pointer">
                                                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                                            </button>
                                            <button data-delete-expense-id="${entry.id}" class="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 cursor-pointer">
                                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        setupExpensesListeners(categories, entries, selectedMonth, classifier, trainingData);

        // Check for global prefilled voice transactions
        if (window.prefilledVoiceTransaction && window.prefilledVoiceTransaction.type === 'expense') {
            const voiceData = window.prefilledVoiceTransaction;
            window.prefilledVoiceTransaction = null; // Clear immediately

            const matchingCat = categories.find(c => c.name.toLowerCase().includes(voiceData.category_name?.toLowerCase() || '')) || categories[0];
            const prefilledEntry = {
                amount: voiceData.amount,
                note: voiceData.note,
                date: voiceData.date,
                category_id: matchingCat ? matchingCat.id : null
            };
            setTimeout(() => openExpenseModal(prefilledEntry, categories, selectedMonth, classifier, trainingData), 100);
        }

    } catch (e) {
        console.error("Expenses view render failure:", e);
        container.innerHTML = `<p class="p-6 text-red-500">Failed to render expenses content: ${e.message}</p>`;
    }
}

/**
 * Event triggers of expense list and breakdown drawers
 */
function setupExpensesListeners(categories, entries, selectedMonth, classifier, trainingData) {
    // 1. ADD MODAL TRIGGER
    document.getElementById('btn-add-expense').addEventListener('click', () => {
        openExpenseModal(null, categories, selectedMonth, classifier, trainingData);
    });

    // 2. MANAGE CATEGORIES TRIGGER
    document.getElementById('btn-manage-exp-categories').addEventListener('click', () => {
        openCategoriesModal(categories);
    });

    // 3. SECURE FILE CSV IMPORTER
    document.getElementById('btn-import-csv').addEventListener('click', () => {
        openCsvImportModal(categories, selectedMonth);
    });

    // 4. COLLAPSED DRAWER ACCORDIONS
    document.querySelectorAll('[data-collapse-trigger]').forEach(div => {
        div.addEventListener('click', (e) => {
            // Stop if they clicked edit/delete within collapsed view
            if (e.target.closest('button')) return;

            const id = div.getAttribute('data-collapse-trigger');
            const drawer = document.getElementById(`drawer-${id}`);
            const arrow = document.querySelector(`[data-arrow-id="${id}"]`);

            if (drawer.classList.contains('hidden')) {
                drawer.classList.remove('hidden');
                arrow.classList.add('rotate-90');
            } else {
                drawer.classList.add('hidden');
                arrow.classList.remove('rotate-90');
            }
        });
    });

    // 5. LIVE SEARCH AND FILTERS CONTROLLER
    const search = document.getElementById('expense-search');
    const filterSelect = document.getElementById('expense-filter-cat');

    const handleSearchFilter = () => {
        const query = search.value.trim().toLowerCase();
        const catTarget = filterSelect.value;

        document.querySelectorAll('.expense-row-element').forEach(row => {
            const catId = row.getAttribute('data-cat-id');
            const noteText = row.getAttribute('data-text-note');
            const amtText = row.getAttribute('data-text-amount');

            const matchesSearch = !query || noteText.includes(query) || amtText.includes(query);
            const matchesCat = catTarget === 'ALL' || catId === catTarget;

            if (matchesSearch && matchesCat) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });
    };

    search.addEventListener('input', handleSearchFilter);
    filterSelect.addEventListener('change', handleSearchFilter);

    // 6. EDIT OR DELETE CRUD TRIGGER HANDLERS
    document.querySelectorAll('[data-edit-expense-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-edit-expense-id');
            const entry = entries.find(e => e.id === id);
            openExpenseModal(entry, categories, selectedMonth, classifier, trainingData);
        });
    });

    document.querySelectorAll('[data-delete-expense-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-delete-expense-id');
            if (confirm("Are you sure you want to permanently delete this expense log?")) {
                showActionSpinner(true);
                try {
                    const { error } = await supabase
                        .from('expense_entries')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    await reFetchAndRenderCurrentView();
                } catch (err) {
                    alert("Delete failed: " + err.message);
                } finally {
                    showActionSpinner(false);
                }
            }
        });
    });
}

/**
 * Add / Edit Expense entry modals
 */
function openExpenseModal(entry, categories, selectedMonth, classifier, trainingData) {
    const isEdit = !!entry;
    const catOptionsHTML = categories.map(c => {
        const sel = isEdit && entry.category_id === c.id ? 'selected' : '';
        return `<option value="${c.id}" ${sel}>${escapeHTML(c.name)}</option>`;
    }).join('');

    const defaultDate = isEdit ? entry.date : `${selectedMonth}-01`;

    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="${isEdit ? 'edit-3' : 'plus-circle'}" class="text-rose-600"></i> ${isEdit ? 'Alter' : 'Record'} Expense
            </h3>
            <p class="text-slate-500 text-xs mb-5">Ensure appropriate categories are tagged to keep financial indicators accurate.</p>

            <form id="expense-entry-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Category</label>
                    <select id="exp-cat-id" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs font-medium font-sans">
                        ${catOptionsHTML}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Expense Date</label>
                    <input type="date" id="exp-date" required value="${defaultDate}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Amount Spend (₹)</label>
                    <input type="number" id="exp-amount" required value="${isEdit ? entry.amount : ''}" min="0.01" step="0.01" placeholder="Enter Spent Amount" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 font-mono text-xs" />
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Observation Memo / Note</label>
                    <input type="text" id="exp-note" value="${isEdit ? escapeHTML(entry.note || '') : ''}" placeholder="E.g., Groceries purchases, uber ride to station" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-modal" class="py-2 border border-slate-200 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Save Expense Record
                    </button>
                </div>
            </form>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

        document.getElementById('expense-entry-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const categoryId = document.getElementById('exp-cat-id').value;
            const date = document.getElementById('exp-date').value;
            const amount = parseFloat(document.getElementById('exp-amount').value);
            const note = document.getElementById('exp-note').value;

            if (isNaN(amount) || amount <= 0) {
                alert("Please enter a valid amount greater than zero.");
                return;
            }

            // Compute month index
            const entryMonth = date.substring(0, 7);
            if (entryMonth !== selectedMonth) {
                const proceed = confirm(`The date entered (${date}) is in a different month than the active view (${selectedMonth}). Do you wish to save it anyway?`);
                if (!proceed) return;
            }

            // Spending Anomaly Checker (2.5 standard deviations)
            if (trainingData && trainingData.length > 0) {
                const categoryData = trainingData.filter(e => e.category_id === categoryId && e.amount);
                if (categoryData.length >= 3) {
                    const amounts = categoryData.map(e => parseFloat(e.amount));
                    const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
                    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
                    const stdDev = Math.sqrt(variance);

                    if (stdDev > 0 && amount > mean + (2.5 * stdDev)) {
                        const proceed = confirm(`Warning: The amount logged (₹${amount}) deviates significantly from your category average (Mean: ₹${mean.toFixed(0)}, StdDev: ₹${stdDev.toFixed(0)}). Is this correct?`);
                        if (!proceed) return;
                    }
                }
            }

            showActionSpinner(true);
            try {
                if (isEdit) {
                    const { error } = await supabase
                        .from('expense_entries')
                        .update({ category_id: categoryId, amount, date, note, month: entryMonth })
                        .eq('id', entry.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('expense_entries')
                        .insert({
                            user_id: currentUser.id,
                            category_id: categoryId,
                            amount,
                            date,
                            note,
                            month: entryMonth
                        });
                    if (error) throw error;
                }

                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Operation failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });

        // Setup AI Autocomplete & Voice dictation listeners
        const expNoteInput = document.getElementById('exp-note');
        const expCatSelect = document.getElementById('exp-cat-id');

        let userManuallyChangedCategory = false;
        expCatSelect.addEventListener('change', () => {
            userManuallyChangedCategory = true;
        });

        if (classifier && !isEdit) {
            expNoteInput.addEventListener('input', () => {
                if (userManuallyChangedCategory) return;
                const predictedCat = classifier.predict(expNoteInput.value);
                if (predictedCat) {
                    expCatSelect.value = predictedCat;
                }
            });
        }
        
        // Refresh icons inside modal
        if (window.lucide) window.lucide.createIcons();
    });
}

/**
 * Handle CSV parser and drop zones (no automatic logic rules!)
 */
function openCsvImportModal(categories, selectedMonth) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="file-spreadsheet" class="text-emerald-600"></i> Import Account CSV
            </h3>
            <p class="text-slate-500 text-xs mb-5">Select a valid CSV file containing transaction statements. Map the primary columns below manually.</p>

            <!-- File uploading screen (Stage 1) -->
            <div id="csv-stage-1" class="space-y-4">
                <div class="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-50 cursor-pointer group transition-all relative">
                    <input type="file" id="csv-file-selector" accept=".csv" class="absolute inset-0 opacity-0 cursor-pointer h-full w-full" />
                    <div class="space-y-2">
                        <div class="bg-white w-10 h-10 rounded-xl text-slate-400 group-hover:text-emerald-600 shadow-sm flex items-center justify-center mx-auto transition-all">
                            <i data-lucide="upload-cloud" class="w-6 h-6"></i>
                        </div>
                        <p class="text-xs font-semibold text-slate-700">Choose CSV file or Drag here</p>
                        <p class="text-[9px] text-slate-400">Values must be standard comma separated</p>
                    </div>
                </div>
            </div>

            <!-- Mapping Screen (Stage 2) -->
            <div id="csv-stage-2" class="hidden space-y-4">
                <div class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p class="text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Statement Loaded successfully! Map columns below.
                    </p>
                </div>

                <div class="space-y-3">
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Date Column</label>
                            <select id="map-date" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"></select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Amount Spend</label>
                            <select id="map-amount" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"></select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Description Note</label>
                            <select id="map-desc" class="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"></select>
                        </div>
                    </div>
                </div>

                <button type="button" id="btn-process-mapped" class="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-md transition-all">
                    Compile Mapping List
                </button>
            </div>

            <!-- Categories Allocation Grid (Stage 3) -->
            <div id="csv-stage-3" class="hidden space-y-4">
                <div class="border-b border-slate-50 pb-2">
                    <h4 class="font-bold text-slate-800 text-xs">Assign Categories Manually</h4>
                    <p class="text-[9px] text-slate-400">Tag each spreadsheet record before final database upload. No auto-allocation of categories matches standard limits.</p>
                </div>

                <!-- Scrollable spreadsheet editor -->
                <div class="max-h-[260px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-white">
                    <div id="csv-allocation-sheets-rows"></div>
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" id="btn-cancel-import" class="py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg text-xs hover:bg-slate-50 transition-all">Cancel</button>
                    <button id="btn-publish-imported" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1">
                        <i data-lucide="cloud-lightning" class="w-3.5 h-3.5"></i> Publish statement (0 entries)
                    </button>
                </div>
            </div>
        </div>
    `;

    showModal(html, () => {
        const fileSelector = document.getElementById('csv-file-selector');
        
        // CSV Parsing tracking state
        let parsedRows = []; // Raw un-headers array
        let headers = [];

        fileSelector.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const text = evt.target.result;
                const rows = text.split(/\r?\n/).filter(l => l.trim().length > 0).map(line => {
                    // split on comma avoiding quoted quotes
                    const result = [];
                    let cur = '';
                    let quotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            quotes = !quotes;
                        } else if (char === ',' && !quotes) {
                            result.push(cur.trim());
                            cur = '';
                        } else {
                            cur += char;
                        }
                    }
                    result.push(cur.trim());
                    return result;
                });

                if (rows.length < 2) {
                    alert("A database statement sheet must contain at least 1 headers line and 1 record line.");
                    return;
                }

                // Stage 1 hide, Stage 2 show
                document.getElementById('csv-stage-1').classList.add('hidden');
                document.getElementById('csv-stage-2').classList.remove('hidden');

                headers = rows[0];
                parsedRows = rows.slice(1);

                // Populate selections
                const selectDate = document.getElementById('map-date');
                const selectAmt = document.getElementById('map-amount');
                const selectDesc = document.getElementById('map-desc');

                const dropHTML = headers.map((h, i) => `<option value="${i}">${h || `Col ${i}`}</option>`).join('');
                selectDate.innerHTML = dropHTML;
                selectAmt.innerHTML = dropHTML;
                selectDesc.innerHTML = dropHTML;

                // Try to predict cols index
                headers.forEach((h, idx) => {
                    const low = h.toLowerCase();
                    if (low.includes('date')) selectDate.value = idx;
                    else if (low.includes('amount') || low.includes('spent') || low.includes('debit')) selectAmt.value = idx;
                    else if (low.includes('desc') || low.includes('note') || low.includes('particular')) selectDesc.value = idx;
                });
            };
            reader.readAsText(file);
        });

        // Mapping compile
        document.getElementById('btn-process-mapped').addEventListener('click', () => {
            const dateIdx = parseInt(document.getElementById('map-date').value);
            const amtIdx = parseInt(document.getElementById('map-amount').value);
            const descIdx = parseInt(document.getElementById('map-desc').value);

            // Stage 2 hide, Stage 3 show
            document.getElementById('csv-stage-2').classList.add('hidden');
            const stage3 = document.getElementById('csv-stage-3');
            stage3.classList.remove('hidden');

            const rowsContainer = document.getElementById('csv-allocation-sheets-rows');
            rowsContainer.innerHTML = '';

            const mappedData = parsedRows.map((r, rowIdx) => {
                // Ensure row has correct indices
                const rowDate = r[dateIdx] || `${selectedMonth}-01`;
                const rawAmt = parseFloat(r[amtIdx] || 0);
                const desc = r[descIdx] || 'Imported Entry';

                // Skip rows where amount is invalid
                if (isNaN(rawAmt) || rawAmt <= 0) return null;

                // Build mapping drop
                const categoryDrop = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

                const item = document.createElement('div');
                item.className = "p-3 bg-slate-50/50 hover:bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs";
                item.innerHTML = `
                    <div class="space-y-0.5 grow">
                        <span class="text-[10px] text-slate-400 font-mono font-bold leading-none block">${rowDate}</span>
                        <input type="text" value="${desc}" class="font-semibold text-slate-800 bg-transparent outline-none w-full border-b border-transparent focus:border-slate-300" id="row-desc-${rowIdx}" />
                        <span class="font-mono text-xs font-semibold text-rose-600 block">₹${rawAmt}</span>
                    </div>
                    <div class="sm:w-1/3 shrink-0">
                        <label class="block text-[8px] uppercase tracking-wider font-bold text-slate-450 mb-0.5">Tag Category</label>
                        <select id="row-cat-${rowIdx}" class="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-sans font-medium">
                            ${categoryDrop}
                        </select>
                    </div>
                `;
                rowsContainer.appendChild(item);

                return {
                    rowIdx,
                    date: rowDate,
                    amount: rawAmt,
                };
            }).filter(Boolean);

            const compileBtn = document.getElementById('btn-publish-imported');
            compileBtn.textContent = `Publish statements (${mappedData.length} entries)`;

            // Bind publish event
            document.getElementById('btn-cancel-import').addEventListener('click', closeModal);

            compileBtn.onclick = async () => {
                showActionSpinner(true);
                try {
                    // Scan current elements to build write logs payload
                    const inserts = mappedData.map(d => {
                        const noteVal = document.getElementById(`row-desc-${d.rowIdx}`).value;
                        const catId = document.getElementById(`row-cat-${d.rowIdx}`).value;
                        
                        // Parse month string YYYY-MM
                        let monthStr = selectedMonth;
                        if (d.date && d.date.length >= 7) {
                            monthStr = d.date.substring(0, 7);
                        }

                        // Try format Date if it's not standard YYYY-MM-DD
                        let isoDate = d.date;
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
                            // Try convert DD/MM/YYYY or MM/DD/YYYY? Simple fallback
                            isoDate = `${selectedMonth}-01`;
                        }

                        return {
                            user_id: currentUser.id,
                            category_id: catId,
                            amount: d.amount,
                            date: isoDate,
                            note: noteVal,
                            month: monthStr
                        };
                    });

                    const { error } = await supabase
                        .from('expense_entries')
                        .insert(inserts);
                    if (error) throw error;

                    closeModal();
                    await reFetchAndRenderCurrentView();
                } catch (err) {
                    alert("Batch write failure: " + err.message);
                } finally {
                    showActionSpinner(false);
                }
            };
        });
    });
}

/**
 * Categories Master CRUD Editor Modals
 */
function openCategoriesModal(categories) {
    const html = `
        <div>
            <h3 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <i data-lucide="tag" class="text-rose-600"></i> Expense Categories
            </h3>
            <p class="text-slate-500 text-xs mb-5">Define or modify categories used in your monthly logging.</p>

            <form id="add-exp-cat-form" class="flex gap-2 mb-4">
                <input type="text" id="new-cat-name" required placeholder="Add Category (E.g., Medical, Subscriptions)" class="grow px-3 py-2 bg-slate-50 border border-slate-200 outline-none rounded-lg focus:border-emerald-500 text-xs" />
                <button type="submit" class="bg-slate-950 hover:bg-slate-800 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer">Add</button>
            </form>

            <div class="max-h-[220px] overflow-y-auto mb-5 border border-slate-100 rounded-lg divide-y divide-slate-100">
                ${categories.length === 0 ? `
                    <p class="p-4 text-center text-slate-400 text-xs">No custom categories established yet.</p>
                ` : categories.map(c => `
                    <div class="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-all text-xs">
                        <input type="text" value="${escapeHTML(c.name)}" data-item-cat-id="${c.id}" class="font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-rose-500 outline-none pb-0.5" />
                        <div class="flex items-center gap-1.5">
                            <button data-save-exp-cat="${c.id}" class="text-emerald-600 hover:text-emerald-700 font-semibold text-[11px] h-6 px-1 cursor-pointer">Save</button>
                            <button data-del-exp-cat="${c.id}" class="text-slate-400 hover:text-red-500 p-1 cursor-pointer">
                                <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="flex justify-end">
                <button type="button" id="btn-close-cat-modal" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs cursor-pointer transition-all">Close Panel</button>
            </div>
        </div>
    `;

    showModal(html, () => {
        document.getElementById('btn-close-cat-modal').addEventListener('click', closeModal);

        document.getElementById('add-exp-cat-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-cat-name').value;

            showActionSpinner(true);
            try {
                const { error } = await supabase
                    .from('expense_categories')
                    .insert({ user_id: currentUser.id, name });
                if (error) throw error;
                
                closeModal();
                await reFetchAndRenderCurrentView();
            } catch (err) {
                alert("Creation failed: " + err.message);
            } finally {
                showActionSpinner(false);
            }
        });

        // Save inline updates
        categories.forEach(c => {
            const saveBtn = document.querySelector(`[data-save-exp-cat="${c.id}"]`);
            saveBtn.style.display = 'none';

            const input = document.querySelector(`input[data-item-cat-id="${c.id}"]`);
            input.addEventListener('input', () => {
                saveBtn.style.display = 'inline-block';
            });

            saveBtn.addEventListener('click', async () => {
                showActionSpinner(true);
                try {
                    const { error } = await supabase
                        .from('expense_categories')
                        .update({ name: input.value })
                        .eq('id', c.id);
                    if (error) throw error;
                    
                    closeModal();
                    await reFetchAndRenderCurrentView();
                } catch (err) {
                    alert("Update failed: " + err.message);
                } finally {
                    showActionSpinner(false);
                }
            });
        });

        // Cascading delete
        document.querySelectorAll('[data-del-exp-cat]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-del-exp-cat');
                if (confirm("Deleting this category cascades and deletes all historical expense records logged in it. Continue?")) {
                    showActionSpinner(true);
                    try {
                        const { error } = await supabase
                            .from('expense_categories')
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
