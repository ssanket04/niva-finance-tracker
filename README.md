# Niva — Personal Finance & Asset Tracker

Niva is a production-grade, privacy-centric vanilla JavaScript web application built on top of **Vite** and **Supabase** for secure, lightning-fast personal ledger and portfolio management.

---

## 🚀 Key Features

1. **Financial Digest Dashboard**:
   * Aggregates month-over-month income, expenses, and investment contributions.
   * Displays **Unallocated Cash** (representing liquid capital remaining after expenses and active investments).
   * Automatically calculates your **Savings Rate** using the industry-standard equation:
     $$\text{Savings Rate} = \frac{\text{Total Income} - \text{Total Expenses}}{\text{Total Income}} \times 100$$
   * Highlights interactive empty-state checklists for new profiles to guide initial setup.

2. **Local AI Category Autocomplete**:
   * Includes a custom, client-side **Naive Bayes Text Classifier** that learns from your transaction history.
   * As you type note descriptions inside the Add Expense log (e.g. `"Zomato lunch"`), it automatically pre-selects the appropriate category (e.g. `"Food"`) on-the-fly.
   * **100% private and runs locally on your CPU**—no external API dependencies, credits, or keys needed.

3. **Typo & Anomaly Detector**:
   * Evaluates standard deviations of category entries locally.
   * Automatically triggers a warning confirmation modal if you enter an amount that deviates by $>2.5\times$ standard deviations from the category mean (e.g. accidental extra zeros).

4. **Smart Context-Aware Portfolio Builder**:
   * Adapts dynamically to asset classes:
     * **Fixed Deposits**: Bank name, Principal, interest rates, start/maturity dates, and quarterly compounding projection logs.
     * **Stocks**: Stock identifier symbol, Qty, and Avg Buy Price (auto-calculates total invested vs. current valuation).
     * **Gold (SGB)**: Series name, Principal, issue/maturity dates, and $2.5\%$ simple annual coupon calculations.
     * **Mutual Funds / US Portfolios**: Mutual fund name, monthly SIP contribution, and current appraisal.

5. **Dynamic Banking Ledger**:
   * Configures bank opening/closing balances, reconciliation sheets, and records monthly cash reserves.

6. **Simulators & Future Wealth Projection**:
   * Evaluates CAGR growth models for SIPs, quarterly compounding formulas for Fixed Deposits, and SGB simple interest logic.

---

## 🛠️ Technology Stack

* **Frontend**: Vanilla ES6+ Javascript, HTML5 (Semantic Structure)
* **Styling**: Vanilla CSS3, Tailwind CSS (Utility classes)
* **Build Tooling**: Vite 6, PostCSS, Autoprefixer, TypeScript (strict compile checks)
* **Database & Security**: Supabase JS SDK, Row Level Security (RLS) policies, PL/pgSQL database triggers.

---

## 📁 Project Structure

```
├── css/
│   └── main.css             # Base CSS styles & bespoke theme configurations
├── js/
│   ├── app.js               # Central routing controller & view loader
│   ├── banks.js             # Banking ledger workspace
│   ├── classifier.js        # Local Naive Bayes Text Classifier
│   ├── dashboard.js         # Financial Digest dashboard
│   ├── expenses.js          # Expense logs, CSV imports, anomaly checks
│   ├── future-wealth.js     # Calculators & projections panels
│   ├── income.js            # Income logs
│   ├── investments.js       # Dynamic portfolio asset builder
│   ├── reports.js           # Analytics & rule-based insights reports
│   ├── supabase.js          # Database client configuration
│   └── utils.js             # Shared helpers & safety XSS sanitizers
├── index.html               # App DOM shell structure
├── schema.sql               # Production database setup script
├── package.json             # Pruned dependencies configuration
└── vite.config.ts           # Bundler build rules
```

---

## 🔒 Database Schema & Security

Niva leverages **Supabase Row Level Security (RLS)** to keep all records private. Users can only read or write records mapped to their `auth.uid() = user_id`.

A clean setup script is generated inside `schema.sql`. Key database components include:
* **Automatic Month Derivation**: Trigger functions on `income_entries` and `expense_entries` automatically compute the `month` column (`YYYY-MM`) from dates to maintain database query efficiency.
* **Auth New User Seed**: When a user registers, the `handle_new_user()` function automatically seeds standard categories (Salary, Mutual Funds, HDFC/SBI bank accounts, etc.) so new accounts are immediately functional.

---

## ⚙️ Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js** (v18+) installed.

### 2. Install Dependencies
Run the command below in the project directory:
```bash
npm install
```

### 3. Database Setup (Supabase)
1. Create a project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** tab in the Supabase Dashboard and click **New Query**.
3. Copy and paste the entire contents of the `/schema.sql` file and click **Run**.

### 4. Environment Variables
Create a `.env` file at the root of the project:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 💻 Running Locally

To launch the local development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📦 Production Deployment (Vercel)

1. Push your code changes to GitHub.
2. Import your repository into [Vercel](https://vercel.com).
3. Set the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project settings.
4. Redeploy the project.

---

## 🧪 Verification Commands

* **Bundling Check**: `npm run build`
* **Lint / Type Check**: `npm run lint`
