// Utilities for Personal Finance Tracker

/**
 * Formats a value using Indian Numbering System (INR) or USD syntax.
 * INR style: ₹1,00,000 or ₹10,50,000
 * USD style: $1,234.50
 */
export function formatCurrency(amount, currency = 'INR') {
    const num = parseFloat(amount || 0);
    if (isNaN(num)) return currency === 'USD' ? '$0' : '₹0';

    if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(num);
    }

    // Custom Indian formatting
    const isNegative = num < 0;
    const absNum = Math.abs(num);
    
    // Get integer and decimals (no decimals for whole rupee representation in spec examples)
    const str = Math.round(absNum).toString();
    let formattedStr = str;
    
    if (str.length > 3) {
        const lastThree = str.substring(str.length - 3);
        const otherParts = str.substring(0, str.length - 3);
        
        // Group digits before last three in pairs
        const groups = [];
        let i = otherParts.length;
        while (i > 0) {
            groups.unshift(otherParts.substring(Math.max(0, i - 2), i));
            i -= 2;
        }
        formattedStr = groups.join(',') + ',' + lastThree;
    }
    
    return (isNegative ? '-' : '') + '₹' + formattedStr;
}

/**
 * Resolves a human-readable display string for YYYY-MM
 * Input: "2026-05" -> "May 2026"
 */
export function getMonthName(yearMonthString) {
    if (!yearMonthString || yearMonthString.length !== 7) return '';
    const [year, month] = yearMonthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Calculates YYYY-MM string of previous month
 */
export function getPrevMonth(yearMonthString) {
    const [year, month] = yearMonthString.split('-').map(Number);
    const date = new Date(year, month - 1 - 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculates YYYY-MM string of next month
 */
export function getNextMonth(yearMonthString) {
    const [year, month] = yearMonthString.split('-').map(Number);
    const date = new Date(year, month - 1 + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Safely runs a feedback check to ensure database elements aren't empty
 */
export function validateAmount(amount) {
    const parsed = parseFloat(amount);
    return !isNaN(parsed) && parsed >= 0;
}
