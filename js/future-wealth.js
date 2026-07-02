import { formatCurrency } from './utils.js';

export function render(container, selectedMonth) {
    // --- 1. RENDER HIGH-FIDELITY CALCULATOR GRID ---
    container.innerHTML = `
        <div class="space-y-6">
            <!-- Header Titles -->
            <div>
                <span class="text-xs uppercase font-semibold text-emerald-600 tracking-wider">COMPOUND CALCULATORS</span>
                <h2 class="text-2xl font-bold tracking-tight text-slate-900">Future Wealth Projection</h2>
                <p class="text-[10px] text-slate-400 mt-0.5">Simulate savings projections using local deterministic math matrices. No AI predictions model.</p>
            </div>

            <!-- Bento Calculators Grid Layout -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <!-- 1. SIP Calculator -->
                <div class="bento-card p-5 space-y-4 hover:border-emerald-500 transition-all select-none">
                    <div class="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <div class="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">
                            <i data-lucide="calculator" class="w-4 h-4"></i>
                        </div>
                        <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">SIP Calculator (INR)</h4>
                    </div>
                    <div class="space-y-3.5 text-xs text-slate-600">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Monthly Investment (₹)</label>
                            <input type="number" id="sip-monthly" value="5000" min="100" step="100" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Return rate (%)</label>
                                <input type="number" id="sip-rate" value="12" min="1" max="50" step="0.5" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tenure (Years)</label>
                                <input type="number" id="sip-years" value="10" min="1" max="40" step="1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                        </div>
                        
                        <!-- Calculated Result displays -->
                        <div class="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-3.5 text-center mt-2.5">
                            <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Projected Maturity Balance</span>
                            <span class="text-base font-mono font-bold text-emerald-650" id="sip-result-fv">₹0</span>
                        </div>
                    </div>
                </div>

                <!-- 2. FD Calculator -->
                <div class="bento-card p-5 space-y-4 hover:border-indigo-500 transition-all select-none">
                    <div class="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <div class="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
                            <i data-lucide="percent" class="w-4 h-4"></i>
                        </div>
                        <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">FD Maturity Calculator</h4>
                    </div>
                    <div class="space-y-3.5 text-xs text-slate-600">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Principal Invested (₹)</label>
                            <input type="number" id="fd-principal" value="100000" min="1000" step="1000" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Interest Rate (%)</label>
                                <input type="number" id="fd-rate" value="7.1" min="1" max="25" step="0.1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tenure (Years)</label>
                                <input type="number" id="fd-years" value="5" min="1" max="20" step="1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                        </div>
                        
                        <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-center mt-2.5">
                            <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Compounded Maturity Payout</span>
                            <span class="text-base font-mono font-bold text-indigo-600" id="fd-result-fv">₹0</span>
                        </div>
                    </div>
                </div>

                <!-- 3. US Fund Calculator -->
                <div class="bento-card p-5 space-y-4 hover:border-violet-500 transition-all select-none col-span-1 md:col-span-2 lg:col-span-1">
                    <div class="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <div class="bg-violet-50 p-1.5 rounded-lg text-violet-600">
                            <i data-lucide="globe-2" class="w-4 h-4"></i>
                        </div>
                        <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">US Fund Projections (USD)</h4>
                    </div>
                    <div class="space-y-3.5 text-xs text-slate-600">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Monthly Contribution ($)</label>
                            <input type="number" id="us-monthly" value="500" min="10" step="50" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Expected Return (%)</label>
                                <input type="number" id="us-rate" value="10" min="1" max="40" step="0.5" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tenure (Years)</label>
                                <input type="number" id="us-years" value="15" min="1" max="40" step="1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                        </div>
                        
                        <div class="bg-violet-50/50 border border-violet-100 rounded-xl p-3.5 text-center mt-2.5">
                            <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Projected Valuation Balance (USD)</span>
                            <span class="text-base font-mono font-bold text-violet-600" id="us-result-fv">$0</span>
                        </div>
                    </div>
                </div>

                <!-- 4. Gold Calculator -->
                <div class="bento-card p-5 space-y-4 hover:border-amber-550 transition-all select-none">
                    <div class="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <div class="bg-amber-50 p-1.5 rounded-lg text-amber-600">
                            <i data-lucide="sparkles" class="w-4 h-4"></i>
                        </div>
                        <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">Gold (SGB) compounding</h4>
                    </div>
                    <div class="space-y-3.5 text-xs text-slate-600">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Initial Gold Principal (₹)</label>
                            <input type="number" id="gold-principal" value="50000" min="1000" step="1000" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Yearly Growth rate (%)</label>
                                <input type="number" id="gold-rate" value="8" min="1" max="25" step="0.5" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tenure (Years)</label>
                                <input type="number" id="gold-years" value="8" min="1" max="30" step="1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                        </div>
                        
                        <div class="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 text-center mt-2.5">
                            <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Projected Gold Value</span>
                            <span class="text-base font-mono font-bold text-amber-650" id="gold-result-fv">₹0</span>
                        </div>
                    </div>
                </div>

                <!-- 5. Liquid Fund Calculator -->
                <div class="bento-card p-5 space-y-4 hover:border-sky-500 transition-all select-none">
                    <div class="flex items-center gap-2 border-b border-slate-50 pb-2.5">
                        <div class="bg-sky-50 p-1.5 rounded-lg text-sky-600">
                            <i data-lucide="droplet" class="w-4 h-4"></i>
                        </div>
                        <h4 class="font-bold text-slate-900 text-xs uppercase tracking-wider">Liquid Fund compounding</h4>
                    </div>
                    <div class="space-y-3.5 text-xs text-slate-600">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Lump Sum Invested (₹)</label>
                            <input type="number" id="liq-principal" value="25000" min="500" step="500" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Expected return (%)</label>
                                <input type="number" id="liq-rate" value="6.5" min="1" max="20" step="0.1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-450 uppercase mb-1">Tenure (Years)</label>
                                <input type="number" id="liq-years" value="3" min="1" max="25" step="1" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800" />
                            </div>
                        </div>
                        
                        <div class="bg-sky-50/50 border border-sky-100 rounded-xl p-3.5 text-center mt-2.5">
                            <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Projected Liquidation Yield</span>
                            <span class="text-base font-mono font-bold text-sky-600" id="liq-result-fv">₹0</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `;

    // Connect event triggers for real-time calculations
    connectCalculatorTriggers();
}

/**
 * Attaches dynamic live calculate action streams as they input parameters
 */
function connectCalculatorTriggers() {
    // 1. SIP calculator formulas:
    // Future Value = P * [((1 + i)^n - 1) / i] * (1 + i)
    // where P = monthly, r = annual, i = r/12/100, n = years*12
    const doSipCalc = () => {
        const p = parseFloat(document.getElementById('sip-monthly').value || 0);
        const r = parseFloat(document.getElementById('sip-rate').value || 0);
        const y = parseFloat(document.getElementById('sip-years').value || 0);
        
        let fv = 0;
        if (r > 0 && y > 0 && p > 0) {
            const i = r / 12 / 100;
            const n = y * 12;
            fv = p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        }
        document.getElementById('sip-result-fv').textContent = formatCurrency(fv, 'INR');
    };

    // 2. FD calculator formulas:
    // Compound interest: A = P * (1 + r/100)^t
    const doFdCalc = () => {
        const p = parseFloat(document.getElementById('fd-principal').value || 0);
        const r = parseFloat(document.getElementById('fd-rate').value || 0);
        const y = parseFloat(document.getElementById('fd-years').value || 0);

        let fv = 0;
        if (p > 0 && r > 0 && y > 0) {
            fv = p * Math.pow(1 + r/100, y);
        }
        document.getElementById('fd-result-fv').textContent = formatCurrency(fv, 'INR');
    };

    // 3. US Fund compound SIP:
    // Future Value (USD) = P * [((1 + i)^n - 1) / i] * (1 + i)
    // where P = monthly USD, i = return/12/100, n = years*12
    const doUsCalc = () => {
        const p = parseFloat(document.getElementById('us-monthly').value || 0);
        const r = parseFloat(document.getElementById('us-rate').value || 0);
        const y = parseFloat(document.getElementById('us-years').value || 0);

        let fv = 0;
        if (p > 0 && r > 0 && y > 0) {
            const i = r / 12 / 100;
            const n = y * 12;
            fv = p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        }
        document.getElementById('us-result-fv').textContent = formatCurrency(fv, 'USD');
    };

    // 4. Gold compounded growth
    // Compound principal: A = P * (1 + r/100)^t
    const doGoldCalc = () => {
        const p = parseFloat(document.getElementById('gold-principal').value || 0);
        const r = parseFloat(document.getElementById('gold-rate').value || 0);
        const y = parseFloat(document.getElementById('gold-years').value || 0);

        let fv = 0;
        if (p > 0 && r > 0 && y > 0) {
            fv = p * Math.pow(1 + r/100, y);
        }
        document.getElementById('gold-result-fv').textContent = formatCurrency(fv, 'INR');
    };

    // 5. Liquid Fund compound principal growth
    // Compound principal: A = P * (1 + r/100)^t
    const doLiqCalc = () => {
        const p = parseFloat(document.getElementById('liq-principal').value || 0);
        const r = parseFloat(document.getElementById('liq-rate').value || 0);
        const y = parseFloat(document.getElementById('liq-years').value || 0);

        let fv = 0;
        if (p > 0 && r > 0 && y > 0) {
            fv = p * Math.pow(1 + r/100, y);
        }
        document.getElementById('liq-result-fv').textContent = formatCurrency(fv, 'INR');
    };

    // Listen to changes reactive format
    ['sip-monthly', 'sip-rate', 'sip-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', doSipCalc);
    });

    ['fd-principal', 'fd-rate', 'fd-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', doFdCalc);
    });

    ['us-monthly', 'us-rate', 'us-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', doUsCalc);
    });

    ['gold-principal', 'gold-rate', 'gold-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', doGoldCalc);
    });

    ['liq-principal', 'liq-rate', 'liq-years'].forEach(id => {
        document.getElementById(id).addEventListener('input', doLiqCalc);
    });

    // Fire initial runs so they render with values loaded
    doSipCalc();
    doFdCalc();
    doUsCalc();
    doGoldCalc();
    doLiqCalc();
}
