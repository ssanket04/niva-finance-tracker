-- Personal Finance Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- 1. INCOME SOURCES
CREATE TABLE public.income_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, name)
);

ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own income sources" ON public.income_sources
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. INCOME ENTRIES
CREATE TABLE public.income_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_id UUID NOT NULL REFERENCES public.income_sources(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date_credited DATE NOT NULL,
    note TEXT,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own income entries" ON public.income_entries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_income_entries_user_month ON public.income_entries(user_id, month);

-- 3. BANK ACCOUNTS
CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, bank_name)
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own bank accounts" ON public.bank_accounts
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. BANK BALANCES (Per month opening/closing tracking)
CREATE TABLE public.bank_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    bank_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    closing_balance NUMERIC NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, bank_id, month)
);

ALTER TABLE public.bank_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own bank balances" ON public.bank_balances
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_bank_balances_user_month ON public.bank_balances(user_id, month);

-- 5. INVESTMENT CATEGORIES
CREATE TABLE public.investment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, name)
);

ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own investment categories" ON public.investment_categories
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. HOLDINGS (Manual assets and SIPs)
CREATE TABLE public.holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category_id UUID NOT NULL REFERENCES public.investment_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    monthly_contribution NUMERIC NOT NULL DEFAULT 0, -- Set if recurring (SIP)
    current_value NUMERIC NOT NULL DEFAULT 0, -- User editable
    notes TEXT,
    -- One time fields (FD/SGB)
    invested_amount NUMERIC NOT NULL DEFAULT 0, -- Initial investment principal
    interest_rate NUMERIC, -- FD %, e.g., 7.1
    start_date DATE,
    maturity_date DATE,
    -- Closure fields
    is_closed BOOLEAN NOT NULL DEFAULT false,
    closure_value NUMERIC,
    closure_date DATE,
    closure_note TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR', -- 'INR' or 'USD'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own holdings" ON public.holdings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. INVESTMENT CONTRIBUTIONS (History of contributions for recurring holdings)
CREATE TABLE public.investment_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    amount NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, holding_id, month)
);

ALTER TABLE public.investment_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own investment contributions" ON public.investment_contributions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_investment_contributions_user_month ON public.investment_contributions(user_id, month);

-- 8. INVESTMENT WITHDRAWALS
CREATE TABLE public.investment_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.investment_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own investment withdrawals" ON public.investment_withdrawals
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. EXPENSE CATEGORIES
CREATE TABLE public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, name)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own expense categories" ON public.expense_categories
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. EXPENSE ENTRIES
CREATE TABLE public.expense_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
    note TEXT,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own expense entries" ON public.expense_entries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_expense_entries_user_month ON public.expense_entries(user_id, month);


-- =========================================================================
-- AUTOMATIC SEEDING ON USER REGISTRATION
-- This function and trigger automatically seed a new user with the default:
-- - Income sources (Salary, Bonus, Other)
-- - Bank accounts (HDFC, IDFC, SBI)
-- - Expense categories (Travel, Trips / Outings, Shopping, Miscellaneous)
-- - Investment categories (Mutual Funds, US Funds, Liquid Funds, PF, Gold (SGB), Fixed Deposits)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Seed Income Sources
    INSERT INTO public.income_sources (user_id, name) VALUES
        (new.id, 'Salary'),
        (new.id, 'Bonus'),
        (new.id, 'Other')
    ON CONFLICT (user_id, name) DO NOTHING;

    -- Seed Bank Accounts
    INSERT INTO public.bank_accounts (user_id, bank_name) VALUES
        (new.id, 'HDFC'),
        (new.id, 'IDFC'),
        (new.id, 'SBI')
    ON CONFLICT (user_id, bank_name) DO NOTHING;

    -- Seed Expense Categories
    INSERT INTO public.expense_categories (user_id, name) VALUES
        (new.id, 'Travel'),
        (new.id, 'Trips / Outings'),
        (new.id, 'Shopping'),
        (new.id, 'Miscellaneous')
    ON CONFLICT (user_id, name) DO NOTHING;

    -- Seed Investment Categories
    INSERT INTO public.investment_categories (user_id, name, is_recurring) VALUES
        (new.id, 'Mutual Funds', true),
        (new.id, 'US Funds', true),
        (new.id, 'Liquid Funds', true),
        (new.id, 'PF', true),
        (new.id, 'Gold (SGB)', false),
        (new.id, 'Fixed Deposits', false)
    ON CONFLICT (user_id, name) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users (runs post-signup)
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
