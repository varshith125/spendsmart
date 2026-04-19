const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const CreditCard = require('../models/CreditCard');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// GET /api/credit-cards — list all cards
router.get('/', async (req, res) => {
  try {
    const cards = await CreditCard.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    console.error('Get credit cards error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/credit-cards — add a new card
router.post(
  '/',
  [
    body('cardName').notEmpty().withMessage('Card name is required'),
    body('creditLimit').isFloat({ min: 1 }).withMessage('Credit limit must be positive'),
    body('billingDate').isInt({ min: 1, max: 31 }).withMessage('Billing date must be 1–31'),
    body('lastFourDigits').optional().matches(/^\d{4}$/).withMessage('Must be 4 digits'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

      const { cardName, lastFourDigits, color } = req.body;
      const creditLimit = Number(req.body.creditLimit);
      const billingDate = Number(req.body.billingDate);
      const currentBalance = Number(req.body.currentBalance) || 0;

      const card = new CreditCard({
        userId: req.userId,
        cardName,
        lastFourDigits: lastFourDigits || '0000',
        creditLimit,
        billingDate,
        color: color || '#8b5cf6',
        currentBalance: currentBalance || 0,
      });

      await card.save();
      res.status(201).json(card);
    } catch (err) {
      console.error('Create credit card error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// POST /api/credit-cards/:id/transactions — log charge or payment
router.post(
  '/:id/transactions',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('type').isIn(['charge', 'payment']).withMessage('Type must be charge or payment'),
    body('category').optional().notEmpty(),
    body('note').optional().isString(),
  ],
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid card id.' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

      const card = await CreditCard.findOne({ _id: req.params.id, userId: req.userId });
      if (!card) return res.status(404).json({ message: 'Card not found.' });

      const amount = Number(req.body.amount);
      const { type, category, note, date } = req.body;

      card.transactions.push({ amount, type, category: category || 'Other', note: note || '', date: date || new Date() });

      // Update running balance
      if (type === 'charge') {
        card.currentBalance += amount;
      } else {
        card.currentBalance = Math.max(0, card.currentBalance - amount);
      }

      await card.save();
      res.status(201).json(card);
    } catch (err) {
      console.error('Add transaction error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// DELETE /api/credit-cards/:id/transactions/:txId — delete a transaction
router.delete('/:id/transactions/:txId', async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.txId)) {
      return res.status(400).json({ message: 'Invalid transaction id.' });
    }

    const card = await CreditCard.findOne({ _id: req.params.id, userId: req.userId });
    if (!card) return res.status(404).json({ message: 'Card not found.' });

    const tx = card.transactions.id(req.params.txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found.' });

    // Reverse balance
    if (tx.type === 'charge') card.currentBalance = Math.max(0, card.currentBalance - tx.amount);
    else card.currentBalance += tx.amount;

    tx.deleteOne();
    await card.save();
    res.json(card);
  } catch (err) {
    console.error('Delete tx error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/credit-cards/:id — delete card
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid card id.' });
    }

    const card = await CreditCard.findOne({ _id: req.params.id, userId: req.userId });
    if (!card) return res.status(404).json({ message: 'Card not found.' });
    await CreditCard.deleteOne({ _id: req.params.id });
    res.json({ message: 'Card deleted.' });
  } catch (err) {
    console.error('Delete card error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
