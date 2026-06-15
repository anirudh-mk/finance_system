import React, { useState, useMemo } from 'react';
import { 
  Plus, X, Wallet, TrendingUp, AlertTriangle, 
  Sparkles, Flame, Snowflake, Banknote
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export default function App() {
  const [income, setIncome] = useState(21000);
  const [essential, setEssential] = useState(2500);
  const [savingsTarget, setSavingsTarget] = useState(10000);
  const [targetAmount, setTargetAmount] = useState(100000);
  const [incrementAmount, setIncrementAmount] = useState(0);
  const [incrementMonth, setIncrementMonth] = useState(12);

  const [debts, setDebts] = useState([
    { id: 1, name: 'e.g. Credit Card / Home Loan', balance: 50000, rate: 0, minPayment: 8235, booster: 1000 }
  ]);

  const [strategy, setStrategy] = useState('avalanche'); // 'avalanche' or 'snowball'

  // --- Helpers ---
  const formatMoney = (val) => `₹${Math.round(val).toLocaleString('en-IN')}`;
  
  // --- Core Calculations ---
  let computedMonthsToTarget = 0;
  let accumulatedSavings = 0;
  if (savingsTarget > 0 || incrementAmount > 0) {
    while (accumulatedSavings < targetAmount && computedMonthsToTarget < 1200) {
      computedMonthsToTarget++;
      let currentMonthlySavings = savingsTarget;
      if (computedMonthsToTarget > incrementMonth) {
        currentMonthlySavings += incrementAmount;
      }
      if (currentMonthlySavings <= 0) break;
      accumulatedSavings += currentMonthlySavings;
    }
  } else {
    computedMonthsToTarget = Infinity;
  }
  
  const targetDate = new Date();
  if (computedMonthsToTarget !== Infinity && computedMonthsToTarget < 1200) {
    targetDate.setMonth(targetDate.getMonth() + computedMonthsToTarget);
  }
  const targetMonthYear = computedMonthsToTarget !== Infinity && computedMonthsToTarget < 1200 
    ? targetDate.toLocaleString('default', { month: 'short', year: 'numeric' }) 
    : 'Never';

  const availableForDebt = Math.max(0, income - essential - savingsTarget);
  
  const totalMinPayment = debts.reduce((sum, d) => sum + d.minPayment, 0);
  const totalBooster = debts.reduce((sum, d) => sum + d.booster, 0);
  const totalAllocated = totalMinPayment + totalBooster;

  const budgetUtilPercent = income > 0 ? (totalAllocated / income) * 100 : 0;
  const isOverBudget = totalAllocated > availableForDebt;

  const minPaymentPercent = income > 0 ? (totalMinPayment / income) * 100 : 0;
  const boosterPercent = income > 0 ? (totalBooster / income) * 100 : 0;
  const surplus = availableForDebt - totalAllocated;
  const surplusPercent = income > 0 && surplus > 0 ? (surplus / income) * 100 : 0;

  // --- Debt Projection Logic ---
  // A simple amortization function that calculates months & interest to payoff
  const calculatePayoff = (debtsList, extraPaymentPool = 0) => {
    let currentDebts = debtsList.map(d => ({ ...d }));
    let months = 0;
    let totalInterest = 0;
    let history = [{ month: 0, balance: currentDebts.reduce((s, d) => s + d.balance, 0) }];

    // Sort strategy
    const sortDebts = (arr) => {
      if (strategy === 'avalanche') {
        return arr.sort((a, b) => b.rate - a.rate); // Highest rate first
      } else {
        return arr.sort((a, b) => a.balance - b.balance); // Smallest balance first
      }
    };

    while (currentDebts.some(d => d.balance > 0) && months < 360) {
      months++;
      currentDebts = sortDebts(currentDebts);
      let pool = extraPaymentPool; // Extra money from boosters + freed up min payments

      for (let i = 0; i < currentDebts.length; i++) {
        let d = currentDebts[i];
        if (d.balance <= 0) continue;

        const monthlyRate = (d.rate / 100) / 12;
        const interest = d.balance * monthlyRate;
        totalInterest += interest;
        d.balance += interest;

        // Apply min payment first
        let payment = d.minPayment;
        
        // If min payment is more than balance, add to pool
        if (payment > d.balance) {
          pool += (payment - d.balance);
          payment = d.balance;
        }
        
        d.balance -= payment;
      }

      // Distribute pool (snowball/avalanche)
      if (pool > 0) {
        for (let i = 0; i < currentDebts.length; i++) {
          let d = currentDebts[i];
          if (d.balance <= 0) continue;
          
          if (pool > d.balance) {
            pool -= d.balance;
            d.balance = 0;
          } else {
            d.balance -= pool;
            pool = 0;
            break;
          }
        }
      }

      const totalBal = currentDebts.reduce((s, d) => s + Math.max(0, d.balance), 0);
      history.push({ month: months, balance: totalBal });
      if (totalBal <= 0) break;
    }

    return { months, totalInterest, history };
  };

  // 1. Min-only plan
  const minPlan = calculatePayoff(debts, 0);
  
  // 2. Boosted plan
  // In a real app, extra payment pool might just be the sum of specific boosters.
  // Here we use the individual debt boosters directly in their calculation or pool them.
  // Let's implement individual boosters + pooling freed min payments.
  const calculateBoostedPayoff = (debtsList) => {
    let currentDebts = debtsList.map(d => ({ ...d }));
    let months = 0;
    let totalInterest = 0;
    let history = [{ month: 0, balance: currentDebts.reduce((s, d) => s + d.balance, 0) }];
    
    // Total static monthly allocation
    const totalMonthlyPayment = totalMinPayment + totalBooster;

    const sortDebts = (arr) => {
      if (strategy === 'avalanche') {
        return arr.sort((a, b) => b.rate - a.rate);
      } else {
        return arr.sort((a, b) => a.balance - b.balance);
      }
    };

    while (currentDebts.some(d => d.balance > 0) && months < 360) {
      months++;
      currentDebts = sortDebts(currentDebts);
      
      let pool = 0;
      
      // Calculate Interest
      for (let i = 0; i < currentDebts.length; i++) {
        let d = currentDebts[i];
        if (d.balance > 0) {
          const interest = d.balance * ((d.rate / 100) / 12);
          totalInterest += interest;
          d.balance += interest;
        }
      }

      // Apply targeted payments (Min + specific booster)
      for (let i = 0; i < currentDebts.length; i++) {
        let d = currentDebts[i];
        if (d.balance <= 0) continue;

        let plannedPayment = d.minPayment + d.booster;
        if (plannedPayment > d.balance) {
          pool += (plannedPayment - d.balance);
          d.balance = 0;
        } else {
          d.balance -= plannedPayment;
        }
      }

      // Distribute pool (freed up payments from closed debts)
      if (pool > 0) {
        for (let i = 0; i < currentDebts.length; i++) {
          let d = currentDebts[i];
          if (d.balance <= 0) continue;
          
          if (pool > d.balance) {
            pool -= d.balance;
            d.balance = 0;
          } else {
            d.balance -= pool;
            pool = 0;
            break;
          }
        }
      }

      const totalBal = currentDebts.reduce((s, d) => s + Math.max(0, d.balance), 0);
      history.push({ month: months, balance: totalBal });
      if (totalBal <= 0) break;
    }
    return { months, totalInterest, history };
  };

  const boostedPlan = calculateBoostedPayoff(debts);

  const monthsSaved = Math.max(0, minPlan.months - boostedPlan.months);
  const interestSaved = Math.max(0, minPlan.totalInterest - boostedPlan.totalInterest);
  const totalOutstanding = debts.reduce((sum, d) => sum + d.balance, 0);

  // Generate Chart Data
  const chartData = [];
  const maxMonths = Math.max(minPlan.months, boostedPlan.months);
  for (let m = 0; m <= maxMonths; m++) {
    const minBal = minPlan.history.find(h => h.month === m)?.balance || 0;
    const boostBal = boostedPlan.history.find(h => h.month === m)?.balance || 0;
    chartData.push({
      month: `M${m}`,
      minOnly: minBal,
      boosted: boostBal
    });
  }

  // Current Date logic for projection
  const projectedDate = new Date();
  projectedDate.setMonth(projectedDate.getMonth() + boostedPlan.months);
  const projectedMonthYear = projectedDate.toLocaleString('default', { month: 'short', year: 'numeric' });

  // Event Handlers
  const handleUpdateDebt = (id, field, value) => {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: parseFloat(value) || 0 } : d));
  };

  const handleUpdateBooster = (id, amount) => {
    setDebts(debts.map(d => d.id === id ? { ...d, booster: d.booster + amount } : d));
  };

  const handleClearBooster = (id) => {
    setDebts(debts.map(d => d.id === id ? { ...d, booster: 0 } : d));
  };

  const handleAddDebt = () => {
    setDebts([...debts, { id: Date.now(), name: 'New Debt', balance: 0, rate: 0, minPayment: 0, booster: 0 }]);
  };

  const handleRemoveDebt = (id) => {
    setDebts(debts.filter(d => d.id !== id));
  };

  return (
    <div>
      {/* HEADER */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <Banknote size={24} />
          </div>
          <div className="brand-text">
            <h1>WealthPath</h1>
            <p>Debt & Savings Planner · INR</p>
          </div>
        </div>
        <div className="header-badges">
          <div className="badge" style={{ background: '#1e293b', color: '#94a3b8', borderColor: '#334155' }}>
            🇮🇳 Indian Rupee
          </div>
          <div className="badge">
            {formatMoney(totalOutstanding)} owed
          </div>
        </div>
      </header>

      {/* MONTHLY CASH FLOW */}
      <div className="section-card">
        <div className="section-title">Monthly Cash Flow</div>
        
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Net Monthly Income (₹)</label>
            <input type="number" className="form-input" value={income} onChange={e => setIncome(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">Essential Needs & Expenses (₹)</label>
            <input type="number" className="form-input" value={essential} onChange={e => setEssential(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Target Monthly Savings (₹)</label>
            <input type="number" className="form-input" value={savingsTarget} onChange={e => setSavingsTarget(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">Financial Goal Target (₹)</label>
            <input type="number" className="form-input" value={targetAmount} onChange={e => setTargetAmount(parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Salary Increment Amount (₹)</label>
            <input type="number" className="form-input" value={incrementAmount} onChange={e => setIncrementAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">Increment After (Months)</label>
            <input type="number" className="form-input" value={incrementMonth} onChange={e => setIncrementMonth(parseInt(e.target.value) || 0)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
          <div>
            <div className="form-label">Goal Target Remaining</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-blue)', lineHeight: 1, marginTop: '0.25rem' }}>
              {computedMonthsToTarget !== Infinity && computedMonthsToTarget < 1200 ? `${computedMonthsToTarget} Months (Achieved by ${targetMonthYear})` : 'Never'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '0.5rem', marginTop: '1rem' }}>
          <div>
            <div className="form-label">Available For Debt Repayment</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-green)', lineHeight: 1 }}>
              {formatMoney(availableForDebt)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              of {formatMoney(income)} income
            </div>
          </div>
          <div style={{ width: '60%' }}>
            <div className="budget-util-header">
              <span>Budget Utilisation</span>
              <span>{Math.min(100, Math.round(budgetUtilPercent))}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-segment progress-min" style={{ width: `${Math.min(100, minPaymentPercent)}%` }}></div>
              <div className="progress-segment progress-booster" style={{ width: `${Math.min(100, boosterPercent)}%` }}></div>
              <div className="progress-segment progress-surplus" style={{ width: `${Math.min(100, surplusPercent)}%` }}></div>
            </div>
            <div className="budget-legends">
              <span style={{color: 'var(--accent-blue)'}}>Min payments {Math.round(minPaymentPercent)}%</span>
              <span style={{color: 'var(--accent-green)'}}>Boosters {Math.round(boosterPercent)}%</span>
              <span style={{color: 'var(--accent-orange)'}}>Surplus {formatMoney(Math.max(0, surplus))}</span>
            </div>
          </div>
        </div>

        {isOverBudget && (
          <div className="alert">
            <AlertTriangle size={18} />
            You've allocated {formatMoney(totalAllocated)} but only {formatMoney(availableForDebt)} is available for debts. Reduce boosters.
          </div>
        )}
      </div>

      {/* CURRENT DUES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Current Dues</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Manage and optimise each debt individually</p>
        </div>
        <div style={{ background: '#451a03', color: '#f59e0b', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem', border: '1px solid #78350f' }}>
          {debts.length} due{debts.length > 1 ? 's' : ''}
        </div>
      </div>

      {debts.map(debt => {
        // Individual debt stats
        let singleMinPlan = calculatePayoff([debt], 0);
        let singleBoostPlan = calculateBoostedPayoff([debt]); // with its booster
        let savedInt = singleMinPlan.totalInterest - singleBoostPlan.totalInterest;
        let savedMo = singleMinPlan.months - singleBoostPlan.months;

        return (
          <div key={debt.id} className="section-card debt-card">
            <div className="debt-header">
              <input 
                type="text" 
                value={debt.name} 
                onChange={(e) => setDebts(debts.map(d => d.id === debt.id ? {...d, name: e.target.value} : d))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600, outline: 'none', width: '70%' }}
              />
              <button className="btn-remove" onClick={() => handleRemoveDebt(debt.id)}>
                <X size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} /> Remove
              </button>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Balance (₹)</label>
                <input type="number" className="form-input" value={debt.balance} onChange={e => handleUpdateDebt(debt.id, 'balance', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Interest Rate (% p.a.)</label>
                <input type="number" className="form-input" value={debt.rate} onChange={e => handleUpdateDebt(debt.id, 'rate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Min Payment (₹/mo)</label>
                <input type="number" className="form-input" value={debt.minPayment} onChange={e => handleUpdateDebt(debt.id, 'minPayment', e.target.value)} />
              </div>
            </div>

            <div className="booster-section">
              <div className="booster-header">
                <div className="booster-title">
                  <Sparkles size={16} /> Monthly Extra Booster
                </div>
                <div className="booster-amount">+{formatMoney(debt.booster)}</div>
              </div>
              
              <input 
                type="range" 
                className="booster-slider" 
                min="0" 
                max={Math.max(10000, debt.balance)} 
                step="500" 
                value={debt.booster} 
                onChange={e => handleUpdateDebt(debt.id, 'booster', e.target.value)}
              />
              
              <div className="booster-quick-btns">
                <button className="quick-btn" onClick={() => handleUpdateBooster(debt.id, 1000)}>+₹1k</button>
                <button className="quick-btn" onClick={() => handleUpdateBooster(debt.id, 2000)}>+₹2k</button>
                <button className="quick-btn" onClick={() => handleUpdateBooster(debt.id, 5000)}>+₹5k</button>
                <button className="quick-btn" onClick={() => handleClearBooster(debt.id)} style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>Clear</button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Custom Monthly Pay (₹)</label>
                  <input type="number" className="form-input" value={debt.minPayment + debt.booster} disabled style={{opacity: 0.7}} />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Months to Close</label>
                  <input type="number" className="form-input" value={singleBoostPlan.months} disabled style={{opacity: 0.7}} />
                </div>
              </div>

              {debt.booster > 0 && (
                <div className="success-msg">
                  🎉 Repaying more saves {formatMoney(Math.max(0, savedInt))} interest & closes {Math.max(0, savedMo)} months faster!
                </div>
              )}
            </div>
          </div>
        )
      })}

      <button className="btn-add" onClick={handleAddDebt}>
        <Plus size={18} /> Add New Due
      </button>

      {/* DASHBOARD OVERVIEW */}
      <div className="section-card" style={{ marginTop: '2rem' }}>
        <div className="section-title">Dashboard Overview</div>
        
        <div className="overview-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-card">
            <div className="stat-title">Total Outstanding</div>
            <div className="stat-value text-red">{formatMoney(totalOutstanding)}</div>
            <div className="stat-sub">across {debts.length} dues</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Boosted Payoff</div>
            <div className="stat-value text-orange">{boostedPlan.months} mo</div>
            <div className="stat-sub">{projectedMonthYear}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Total Interest</div>
            <div className="stat-value text-red">{formatMoney(boostedPlan.totalInterest)}</div>
            <div className="stat-sub">boosted plan</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Interest Saved</div>
            <div className="stat-value text-green">{formatMoney(interestSaved)}</div>
            <div className="stat-sub">{monthsSaved} mo faster</div>
          </div>
        </div>

        {/* PLAN COMPARISON */}
        <div className="section-card" style={{ background: 'transparent', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div className="section-title">Plan Comparison</div>
          <div className="comparison-list">
            <div className="comparison-item">
              <span>Min-Only Payoff</span>
              <span className="val-red">{minPlan.months} months</span>
            </div>
            <div className="comparison-item">
              <span>Boosted Payoff</span>
              <span className="val-green">{boostedPlan.months} months</span>
            </div>
            <div className="comparison-item">
              <span>Time Saved</span>
              <span className="val-green">{monthsSaved} months faster</span>
            </div>
            <div className="comparison-item" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Min-Only Interest</span>
              <span className="val-red">{formatMoney(minPlan.totalInterest)}</span>
            </div>
            <div className="comparison-item">
              <span>Boosted Interest</span>
              <span className="val-green">{formatMoney(boostedPlan.totalInterest)}</span>
            </div>
            <div className="comparison-item">
              <span>Interest Saved 🎉</span>
              <span className="val-green">✨ {formatMoney(interestSaved)}</span>
            </div>
          </div>
        </div>

        {/* REPAYMENT STRATEGY */}
        <div className="section-card" style={{ background: 'transparent' }}>
          <div className="section-title">Repayment Strategy</div>
          <div className="strategy-grid">
            <div 
              className={`strategy-btn ${strategy === 'avalanche' ? 'active' : ''}`}
              onClick={() => setStrategy('avalanche')}
            >
              <div className="strategy-title"><Flame size={16} /> Avalanche</div>
              <div className="strategy-sub" style={{ color: strategy === 'avalanche' ? 'var(--accent-green)' : ''}}>Highest rate first</div>
            </div>
            <div 
              className={`strategy-btn ${strategy === 'snowball' ? 'active' : ''}`}
              onClick={() => setStrategy('snowball')}
            >
              <div className="strategy-title"><Snowflake size={16} /> Snowball</div>
              <div className="strategy-sub" style={{ color: strategy === 'snowball' ? 'var(--accent-green)' : ''}}>Smallest balance first</div>
            </div>
          </div>
          <div className="strategy-desc">
            {strategy === 'avalanche' 
              ? <><strong style={{color: '#f59e0b'}}>Avalanche</strong> — Pay minimums on all, then throw extra cash at the highest interest rate. Mathematically optimal: saves the most money.</>
              : <><strong style={{color: '#3b82f6'}}>Snowball</strong> — Pay minimums on all, then throw extra cash at the smallest balance. Psychological wins: clears individual debts faster.</>
            }
          </div>
        </div>

        {/* BALANCE PROJECTION CHART */}
        <div className="section-card" style={{ background: 'transparent', marginBottom: 0 }}>
          <div className="section-title">Balance Projection</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₹${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value) => [formatMoney(value), '']}
                />
                <Legend verticalAlign="bottom" height={36} iconType="plainline"/>
                <Line 
                  type="monotone" 
                  dataKey="boosted" 
                  name="Boosted Plan" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="minOnly" 
                  name="Min-Only" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
