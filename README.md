# Niva — Premium Personal Ledger & Investment Tracker

Niva is a production-grade, privacy-first personal wealth management app built using **Vanilla JavaScript (ES6+)**, **Tailwind CSS**, **Vite**, and **Supabase**. 

Unlike standard, generic expense trackers, Niva provides on-device AI categorization, anomaly threat controls, and mathematically precise projections for banking, fixed deposits, stocks, mutual funds, and gold.

---

## 💎 What Makes Niva Unique? (The Niva Edge)

Most expense trackers only log simple lists of income and expenses. Niva is built as a complete **personal balance sheet** with advanced features:

1. **Local On-Device AI Classifier (100% Private)**:
   * Uses an embedded **Naive Bayes text classifier** running on the client CPU.
   * Auto-suggests expense categories as you type the transaction description note.
   * **Zero latency, zero network cost, and absolute privacy** (no external AI calls).

2. **Typo Anomaly Scanner**:
   * Evaluates standard deviations of category entries in real time.
   * Prompts a warning confirmation modal if you enter an amount that deviates by $>2.5\times$ from your category average (e.g., entering ₹10,000 instead of ₹1,000 by accident).

3. **Smart Investment Ledger (Sovereign Gold, FDs, Stocks)**:
   * Adapts form logic dynamically depending on the asset class:
     * **Sovereign Gold Bonds (SGB)**: Calculates simple annual interest payouts ($2.5\%$).
     * **Fixed Deposits**: Projects maturity value using standard quarterly compounding:
       $$A = P \times \left(1 + \frac{r}{400}\right)^{4t}$$
     * **Stocks**: Computes CAGR returns, average buy prices, and net valuations.
     * **Mutual Funds / US Portfolios**: Tracks recurring monthly SIPs.

4. **Correct Savings Mathematics**:
   * Standard trackers treat investments as "expenses," showing an artificially low savings rate.
   * Niva isolates **Unallocated Cash** (Cash remaining after expenses and investments) and treats investment contributions as saved capital to calculate an accurate **Savings Rate**:
     $$\text{Savings Rate} = \frac{\text{Total Income} - \text{Total Expenses}}{\text{Total Income}} \times 100$$

5. **Dual-Identity Authentication**:
   * Sign up with a unique **Username** + **Email** + **Password**.
   * Log in using either your **Email** or **Username**.
   * Replaces raw emails with custom usernames in all UI displays to protect privacy.

---

## 🚀 Key Features

* **Financial Digest Dashboard**: Interactive welcome onboarding check-lists, MoM metrics, live Net worth indicator, and an interactive SVG allocation breakdown donut chart.
* **Income & Expense Workspace**: Debit/credit log registers, out-of-month date validation warnings, and instant CSV statement imports.
* **Dynamic Banking Ledger**: Month-by-month reconciliation, opening vs. closing cash balance registers.
* **Reports Analytics**: Rule-based financial audit logs assessing savings rates and spending behaviors.
* **Future Wealth Planning**: Compound growth simulators for SIPs, quarterly compounding FDs, SGB yields, and stock CAGR.
* **Mobile-First Responsiveness**: Responsive header scaling, dynamic icons-only bottom navigation on screens down to 320px width (e.g. iPhone SE).

---

## 🔒 Security Specifications

* **Row Level Security (RLS)**: Enforced strictly in Postgres. The database limits queries using `auth.uid() = user_id`. No user can ever read, update, or delete another user's financial ledger data.
* **Authentication**: Secured via Supabase Auth (SHA-256 password hashing, token validation, secure session management).
* **XSS Sanitization**: All user note logs, bank names, and descriptions are sanitized through an HTML escaping matrix before rendering.
* **Secure Session Storage**: Supabase credentials and Gemini keys are kept in browser `sessionStorage` (cleared automatically when the tab is closed) rather than persistent `localStorage`.

---

## 📁 Folder Structure

```
├── css/
│   └── main.css             # Fluid background rules & responsive overrides
├── js/
│   ├── app.js               # Main routing controller & Auth UI forms
│   ├── banks.js             # Banking ledger workspace
│   ├── classifier.js        # Naive Bayes ML classifier
│   ├── dashboard.js         # Financial Digest dashboard
│   ├── expenses.js          # Expense logs, CSV imports, anomaly checks
│   ├── future-wealth.js     # Projections compounding simulators
│   ├── income.js            # Income logs
│   ├── investments.js       # Dynamic portfolio asset class ledger
│   ├── reports.js           # Analytics & rule-based insights reports
│   ├── supabase.js          # DB client setups
│   └── utils.js             # Shared helpers & XSS sanitization
├── index.html               # Main DOM shell structure
├── schema.sql               # Production database setup script
├── package.json             # Pruned project configuration
└── vite.config.ts           # Vite build resolution rules
```

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
4. To safely migrate existing users and enable username support, copy and run the migration script inside `/profiles_migration.sql`.

### 4. Environment Variables
Create a `.env` file at the root of the project:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 💻 Running Locally & Testing

To launch the local development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

* **Bundling Check**: `npm run build`
* **Lint / Type Check**: `npm run lint`
