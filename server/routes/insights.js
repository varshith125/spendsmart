const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Expense = require('../models/Expense');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// Initialize Gemini if key exists
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// GET /api/insights — generate smart insights
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setMilliseconds(-1);

    // 3-month window for trend analysis
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const [monthExpenses, lastMonthExpenses, weekExpenses, lastWeekExpenses, allExpenses, recentExpenses, user] =
      await Promise.all([
        Expense.find({ userId: req.userId, type: { $ne: 'income' }, date: { $gte: startOfMonth, $lte: endOfMonth } }).lean(),
        Expense.find({ userId: req.userId, type: { $ne: 'income' }, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } }).lean(),
        Expense.find({ userId: req.userId, type: { $ne: 'income' }, date: { $gte: startOfWeek, $lte: now } }).lean(),
        Expense.find({ userId: req.userId, type: { $ne: 'income' }, date: { $gte: startOfLastWeek, $lte: endOfLastWeek } }).lean(),
        Expense.find({ userId: req.userId }).sort({ date: -1 }).lean(),
        Expense.find({ userId: req.userId, type: { $ne: 'income' }, date: { $gte: threeMonthsAgo } }).lean(),
        User.findById(req.userId).select('monthlyBudget yearlyIncome name').lean(),
      ]);

    const insights = [];
    const spendExpenses = (arr) => arr.filter(e => e.category !== 'Savings');

    // 1. Top spending category this month
    const catTotals = {};
    spendExpenses(monthExpenses).forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      insights.push({
        id: 'top-category',
        icon: '🏆',
        headline: `Top spend: ${topCat[0]}`,
        detail: `You've spent ₹${Math.round(topCat[1]).toLocaleString('en-IN')} on ${topCat[0]} this month.`,
        sentiment: 'info',
      });
    }

    // 2. vs Last month spend comparison
    const thisMonthTotal = spendExpenses(monthExpenses).reduce((s, e) => s + e.amount, 0);
    const lastMonthTotal = spendExpenses(lastMonthExpenses).reduce((s, e) => s + e.amount, 0);
    if (lastMonthTotal > 0) {
      const delta = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
      insights.push({
        id: 'month-compare',
        icon: delta > 0 ? '📈' : '📉',
        headline: `${Math.abs(delta)}% ${delta > 0 ? 'more' : 'less'} spent vs last month`,
        detail: `This month: ₹${Math.round(thisMonthTotal).toLocaleString('en-IN')} vs last month: ₹${Math.round(lastMonthTotal).toLocaleString('en-IN')}.`,
        sentiment: delta > 20 ? 'danger' : delta > 0 ? 'warning' : 'good',
      });
    }

    // 3. Average daily spend
    const daysElapsed = Math.max(1, now.getDate());
    const avgDaily = Math.round(thisMonthTotal / daysElapsed);
    if (monthExpenses.length > 0) {
      insights.push({
        id: 'avg-daily',
        icon: '📊',
        headline: `Avg daily spend: ₹${avgDaily.toLocaleString('en-IN')}`,
        detail: `Based on ${daysElapsed} days of data. Projected month: ₹${(avgDaily * 30).toLocaleString('en-IN')}.`,
        sentiment: 'info',
      });
    }

    // 4. Budget health
    if (user?.monthlyBudget > 0) {
      const pct = Math.round((thisMonthTotal / user.monthlyBudget) * 100);
      insights.push({
        id: 'budget-health',
        icon: pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅',
        headline: `Budget: ${pct}% used`,
        detail: pct >= 100 ? 'You are over budget!' : `₹${Math.round(user.monthlyBudget - thisMonthTotal).toLocaleString('en-IN')} left.`,
        sentiment: pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'good',
      });
    }

    // 5. Logging streak
    if (allExpenses.length > 0) {
      let streak = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today); checkDate.setDate(checkDate.getDate() - i);
        const dayStr = checkDate.toISOString().split('T')[0];
        const hasEntry = allExpenses.some(e => new Date(e.date).toISOString().split('T')[0] === dayStr);
        if (hasEntry) streak++; else if (i > 0) break;
      }
      if (streak >= 3) {
        insights.push({
          id: 'streak', icon: '🔥', headline: `${streak}-day streak!`,
          detail: `You've tracked for ${streak} consecutive days. Keep it up!`, sentiment: 'good',
        });
      }
    }

    // --- GEMINI AI STRATEGY GENERATION ---
    if (genAI && monthExpenses.length > 0) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const budgetStatus = user?.monthlyBudget ? `Budget: ₹${user.monthlyBudget}. Spent: ₹${thisMonthTotal}.` : '';
        const categoryData = Object.entries(catTotals).map(([k, v]) => `${k}: ₹${v}`).join(', ');

        const prompt = `
          Acting as a professional financial advisor for ${user?.name || 'the user'}.
          Analyze this month's spending: ${categoryData}.
          ${budgetStatus}
          Provide ONE concise, actionable smart strategy (max 2 sentences) to save money next month. 
          Focus on the highest category or the budget status.
          Be encouraging but direct. Do not use bold markdown.
        `;

        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text().trim();

        if (aiResponse) {
          insights.unshift({
            id: 'ai-strategy',
            icon: '✨',
            headline: 'Gemini Smart Strategy',
            detail: aiResponse,
            sentiment: 'good',
          });
        }
      } catch (aiErr) {
        console.error('Gemini Error:', aiErr.message);
      }
    }

    res.json(insights);
  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
