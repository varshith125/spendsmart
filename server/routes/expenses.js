const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Loan = require('../models/Loan');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// POST /api/expenses — create expense
router.post(
  '/',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('category').notEmpty().withMessage('Category is required'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { amount, category, type, note, date, isRecurring } = req.body;

      const expense = new Expense({
        userId: req.userId,
        amount,
        type: type || 'expense',
        category,
        note: note || '',
        isRecurring: isRecurring || false,
        date: date || new Date(),
      });

      await expense.save();
      res.status(201).json(expense);
    } catch (err) {
      console.error('Create expense error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// GET /api/expenses/summary — aggregated dashboard data
router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get user for budget and income
    const user = await User.findById(req.userId).select('monthlyBudget yearlyIncome');

    // This month's transactions
    const monthTransactions = await Expense.find({
      userId: req.userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const monthExpenses = monthTransactions.filter((t) => t.type !== 'income');
    const monthIncomes = monthTransactions.filter((t) => t.type === 'income');

    // Total spent this month
    const totalThisMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    let adHocIncome = monthIncomes.reduce((sum, e) => sum + e.amount, 0);

    // Add borrowed money to income for the month it was borrowed
    const monthLoans = await Loan.find({
      userId: req.userId,
      type: 'Borrowed',
      startDate: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const borrowedIncome = monthLoans.reduce((sum, l) => sum + l.principalAmount, 0);
    adHocIncome += borrowedIncome;

    // Auto-Save calculations
    const autoSaveLoans = await Loan.find({ userId: req.userId, type: 'AutoSave', status: 'Active' });
    let autoSaveThisMonth = 0;
    let totalAutoSavedAllTime = 0;

    autoSaveLoans.forEach(loan => {
      // Calculate months passed
      const startYear = loan.startDate.getFullYear();
      const startMonth = loan.startDate.getMonth();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth();

      let monthsPassed = (nowYear - startYear) * 12 + (nowMonth - startMonth);
      if (now.getDate() >= loan.paymentDay) {
        monthsPassed++;
      }
      
      if (monthsPassed > loan.durationMonths) monthsPassed = loan.durationMonths;
      if (monthsPassed < 0) monthsPassed = 0;

      totalAutoSavedAllTime += (monthsPassed * loan.monthlyEMI);

      // Check if this month is within the active duration
      const loanEndDT = new Date(loan.startDate);
      loanEndDT.setMonth(loanEndDT.getMonth() + loan.durationMonths);
      if (now <= loanEndDT || (nowYear === loanEndDT.getFullYear() && nowMonth === loanEndDT.getMonth())) {
        autoSaveThisMonth += loan.monthlyEMI;
      }
    });

    const baseMonthlyIncome = (user?.yearlyIncome || 0) / 12;
    const totalMonthlyIncome = baseMonthlyIncome + adHocIncome;
    const totalOutflowThisMonth = totalThisMonth + autoSaveThisMonth;

    // Category breakdown
    const categoryMap = {};
    monthExpenses.forEach((e) => {
      if (!categoryMap[e.category]) {
        categoryMap[e.category] = 0;
      }
      categoryMap[e.category] += e.amount;
    });

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, total]) => ({
        name,
        total: Math.round(total * 100) / 100,
        percent: totalThisMonth > 0 ? Math.round((total / totalThisMonth) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Highest category
    const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

    // Daily totals for chart
    const daysInMonth = endOfMonth.getDate();
    const dailyTotals = Array(daysInMonth).fill(0);
    monthExpenses.forEach((e) => {
      const day = new Date(e.date).getDate();
      dailyTotals[day - 1] += e.amount;
    });

    // Budget info
    const budget = user?.monthlyBudget || 0;
    const percentUsed = budget > 0 ? Math.round((totalOutflowThisMonth / budget) * 100) : 0;
    const percentIncomeUsed = totalMonthlyIncome > 0 ? Math.round((totalOutflowThisMonth / totalMonthlyIncome) * 100) : 0;

    // Recent 5 transactions (all time)
    const recentExpenses = await Expense.find({ userId: req.userId })
      .sort({ date: -1 })
      .limit(5);

    // All-time savings
    const allSavingsArr = await Expense.find({
      userId: req.userId,
      category: 'Savings',
    });
    let totalSavings = allSavingsArr.reduce((sum, e) => sum + e.amount, 0);
    totalSavings += totalAutoSavedAllTime;

    res.json({
      totalThisMonth: Math.round(totalOutflowThisMonth * 100) / 100,
      totalMonthlyIncome: Math.round(totalMonthlyIncome * 100) / 100,
      totalSavings: Math.round(totalSavings * 100) / 100,
      expenseCount: monthExpenses.length,
      incomeCount: monthIncomes.length,
      highestCategory,
      categoryBreakdown,
      dailyTotals: dailyTotals.map((v) => Math.round(v * 100) / 100),
      budget,
      spent: Math.round(totalThisMonth * 100) / 100,
      percentUsed,
      percentIncomeUsed,
      recentExpenses,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/expenses/monthly-report?month=3&year=2025 — monthly breakdown for a specific month
router.get('/monthly-report', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month ?? now.getMonth()); // 0-indexed
    const year = parseInt(req.query.year ?? now.getFullYear());

    if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(year) || year < 1970) {
      return res.status(400).json({ message: 'Invalid month or year.' });
    }

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    // Previous month for comparison
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const startOfPrev = new Date(prevYear, prevMonth, 1);
    const endOfPrev = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);

    const user = await User.findById(req.userId).select('monthlyBudget yearlyIncome');

    // This month's transactions
    const monthTransactions = await Expense.find({
      userId: req.userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const prevTransactions = await Expense.find({
      userId: req.userId,
      date: { $gte: startOfPrev, $lte: endOfPrev },
    });

    const monthExpenses = monthTransactions.filter(t => t.type !== 'income');
    const monthIncomes = monthTransactions.filter(t => t.type === 'income');
    const monthSavings = monthTransactions.filter(t => t.category === 'Savings');

    const prevExpenses = prevTransactions.filter(t => t.type !== 'income');

    const totalSpent = monthExpenses.filter(e => e.category !== 'Savings').reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = monthIncomes.reduce((sum, e) => sum + e.amount, 0) + (user?.yearlyIncome || 0) / 12;
    const totalSaved = monthSavings.reduce((sum, e) => sum + e.amount, 0);
    const prevTotalSpent = prevExpenses.filter(e => e.category !== 'Savings').reduce((sum, e) => sum + e.amount, 0);

    // Category breakdown
    const categoryMap = {};
    monthExpenses.filter(e => e.category !== 'Savings').forEach(e => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, total]) => ({
        name,
        total: Math.round(total * 100) / 100,
        percent: totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Daily totals
    const daysInMonth = endOfMonth.getDate();
    const dailyTotals = Array(daysInMonth).fill(0);
    monthExpenses.filter(e => e.category !== 'Savings').forEach(e => {
      const day = new Date(e.date).getDate();
      dailyTotals[day - 1] += e.amount;
    });

    // Spending change vs previous month
    const spendingChange = prevTotalSpent > 0
      ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100)
      : null;

    const budget = user?.monthlyBudget || 0;
    const percentUsed = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
    const netBalance = totalIncome - totalSpent - totalSaved;

    res.json({
      month,
      year,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalSaved: Math.round(totalSaved * 100) / 100,
      netBalance: Math.round(netBalance * 100) / 100,
      budget,
      percentUsed,
      spendingChange,
      prevTotalSpent: Math.round(prevTotalSpent * 100) / 100,
      categoryBreakdown,
      dailyTotals: dailyTotals.map(v => Math.round(v * 100) / 100),
      transactionCount: monthExpenses.length + monthIncomes.length,
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/expenses — list all expenses for user
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/expenses/:id — delete expense
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid expense id.' });
    }

    const expense = await Expense.findOne({ _id: req.params.id, userId: req.userId });
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found.' });
    }
    await Expense.deleteOne({ _id: req.params.id });
    res.json({ message: 'Expense deleted.' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/expenses — delete all expenses for user
router.delete('/', async (req, res) => {
  try {
    await Expense.deleteMany({ userId: req.userId });
    res.json({ message: 'All expenses deleted.' });
  } catch (err) {
    console.error('Delete all expenses error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});


module.exports = router;
