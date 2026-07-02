# Niva — Personal Finance & Asset Tracker

Niva is a production-grade, highly optimized vanilla JavaScript web application built on top of **Vite** and **Supabase** for secure, lightning-fast personal ledger and portfolio management.

---

## Key Features

1.  **Financial Dashboard**: Aggregates month-over-month income, expenses, confirmed contributions, and banking balances to show a real-time live Net Worth snapshot.
2.  **Smart Context-Aware Investments**: Dynamic creation interface adapts automatically depending on holding class:
    *   **Fixed Deposits**: Bank name, Principal invested, interest rate, start/maturity dates, and current value.
    *   **Stocks**: Stock name, optional Qty and Avg Buy Price (auto-calculates total invested), and current valuation.
    *   **Gold (SGB)**: Series name, Principal, issue/maturity dates, and current valuation.
    *   **US Funds / Mutual Funds**: Name, monthly SIP contributions, and current market appraisal.
3.  **Dynamic Banking Ledger**: Configures bank opening/closing balances and computes cash reserves for the selected billing month.
4.  **Transaction History logs**: Complete tracking panels for Income credits, Expense debits, and CSV statement uploads.
5.  **MoM reports & analytics**: Compiled category lists, absolute yields, and rules-based insights assessing savings rates and spending behaviors.
6.  **Future Wealth Planning**: Math-based growth simulators for SIPs, Fixed Deposits, Gold, Liquid reserves, and US portfolios.

---

## Technology Stack

*   **Core**: Vanilla JavaScript (ES6 Modules), HTML5 (Semantic Structure)
*   **Styling**: Vanilla CSS3, Tailwind CSS (Utility classes)
*   **Build Pipeline**: Vite 6, PostCSS, Autoprefixer, TypeScript (lint compilation checks)
*   **Database & Security**: Supabase JS SDK, Row Level Security (RLS) policies, database trigger procedures.

---

## Project Structure

```
├── assets/                  # AI Studio and Git configuration assets
├── css/
│   └── main.css             # Base CSS styles & bespoke theme configurations
├── js/
│   ├── app.js               # Main routing controller & view loader
│   ├── banks.js             # Banking ledger workspace
│   ├── dashboard.js         # Financial Digest dashboard
│   ├── expenses.js          # Expense logs & CSV imports
│   ├── future-wealth.js     # sim calculations panels
│   ├── income.js            # Income logs
│   ├── investments.js       # Dynamic portfolio asset builder
│   ├── reports.js           # Analytics & rule-based insights reports
│   ├── supabase.js          # Database client initializer
│   └── utils.js             # Shared helpers & security sanitation
├── index.html               # App DOM structure and assets shell
├── schema.sql               # Production database setup scripts
├── package.json             # Pruned dependencies configuration
└── vite.config.ts           # Bundler build rules
```

---

## Database Schema & Policies

Niva leverages **Supabase Row Level Security (RLS)** to keep all records private. Users can only read or write records mapped to their `auth.uid() = user_id`.

A clean deployment script is generated inside `schema.sql`. Key database components include:
*   **Income, Expense, and Banking Tables**
*   **Holdings Ledger**: Tracks active and closed assets.
*   **Auto-Derivation triggers**: `trg_income_month` and `trg_expense_month` automatically derive the `month` column (`YYYY-MM`) from dates to guarantee data alignment.
*   **Auth seed hook**: New signups automatically receive standard categories (Salary, Mutual Funds, Stocks, HDFC/SBI bank accounts, etc.) via `handle_new_user()` trigger logic on `auth.users`.

---

## Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js** (v18+) installed.

### 2. Install Dependencies
Run the command below in the project directory:
```bash
npm install
```

### 3. Database Setup (Supabase)
1.  Create a project on [Supabase](https://supabase.com).
2.  Go to the **SQL Editor** tab in the Supabase Dashboard and click **New Query**.
3.  Copy and paste the entire contents of the `/schema.sql` file and click **Run**.

### 4. Environment Variables
Create a `.env` file at the root of the project:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Running Locally

To launch the local development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Production Deployment (Vercel)

1.  Push your code changes to GitHub.
2.  Import your repository into [Vercel](https://vercel.com).
3.  Set the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project settings.
4.  Redeploy the project.

---

## Verification & Commands

*   **Bundling Check**: `npm run build`
*   **Lint / Type Check**: `npm run lint`
