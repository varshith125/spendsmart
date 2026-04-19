const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Loan = require('../models/Loan');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// POST /api/loans - Create new loan/borrowing
router.post(
  '/',
  [
    body('type').isIn(['Lent', 'Borrowed', 'AutoSave']).withMessage('Invalid type'),
    body('partyName').notEmpty().withMessage('Person or App name is required'),
    body('principalAmount').isFloat({ min: 0 }).withMessage('Principal must be positive'),
    body('interestRate').isFloat({ min: 0 }).withMessage('Interest rate must be positive'),
    body('durationMonths').isInt({ min: 1 }).withMessage('Duration must be at least 1 month'),
    body('paymentDay').isInt({ min: 1, max: 31 }).withMessage('Payment day must be between 1 and 31'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { type, partyName, principalAmount, interestRate, durationMonths, startDate, endDate, paymentDay } = req.body;

      // EMI Calculation
      let monthlyEMI;
      let totalAmount;

      if (type === 'AutoSave') {
        // For auto-save, principalAmount is the monthly deposit amount
        monthlyEMI = principalAmount;
        totalAmount = principalAmount * durationMonths;
      } else if (interestRate > 0) {
        const r = (interestRate / 12) / 100; // monthly interest rate
        const n = durationMonths;
        const P = principalAmount;
        
        monthlyEMI = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        totalAmount = monthlyEMI * n;
      } else {
        monthlyEMI = principalAmount / durationMonths;
        totalAmount = principalAmount;
      }

      const start = startDate ? new Date(startDate) : new Date();
      
      let calcEndDate = endDate;
      if (!calcEndDate) {
        const temp = new Date(start);
        temp.setMonth(temp.getMonth() + durationMonths);
        calcEndDate = temp;
      }

      const pDay = paymentDay || start.getDate();

      const loan = new Loan({
        userId: req.userId,
        type,
        partyName,
        principalAmount,
        interestRate,
        durationMonths,
        startDate: start,
        endDate: calcEndDate,
        paymentDay: pDay,
        monthlyEMI: Math.round(monthlyEMI * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
      });

      await loan.save();
      res.status(201).json(loan);
    } catch (err) {
      console.error('Create loan error:', err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// GET /api/loans - get all loans for user
router.get('/', async (req, res) => {
  try {
    const loans = await Loan.find({ userId: req.userId }).sort({ startDate: -1 });
    res.json(loans);
  } catch (err) {
    console.error('Get loans error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/loans/:id - update loan status
router.put(
  '/:id',
  [body('status').optional().isIn(['Active', 'Completed']).withMessage('Invalid status')],
  async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid loan id.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const loan = await Loan.findOne({ _id: req.params.id, userId: req.userId });
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }

    if (req.body.status) {
      loan.status = req.body.status;
    }

    await loan.save();
    res.json(loan);
  } catch (err) {
    console.error('Update loan error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/loans/:id - delete loan
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid loan id.' });
    }

    const loan = await Loan.findOne({ _id: req.params.id, userId: req.userId });
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found.' });
    }
    await Loan.deleteOne({ _id: req.params.id });
    res.json({ message: 'Loan deleted.' });
  } catch (err) {
    console.error('Delete loan error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
