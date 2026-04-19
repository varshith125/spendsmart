const mongoose = require('mongoose');

const creditCardTransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  type: { type: String, enum: ['charge', 'payment'], default: 'charge' },
  category: { type: String, default: 'Other' },
  note: { type: String, trim: true, maxlength: 200, default: '' },
  date: { type: Date, default: Date.now },
});

const creditCardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  cardName: {
    type: String,
    required: [true, 'Card name is required'],
    trim: true,
    maxlength: 60,
  },
  lastFourDigits: {
    type: String,
    match: [/^\d{4}$/, 'Must be exactly 4 digits'],
    default: '0000',
  },
  creditLimit: {
    type: Number,
    required: [true, 'Credit limit is required'],
    min: [1, 'Limit must be positive'],
  },
  billingDate: {
    type: Number,
    required: [true, 'Billing date is required'],
    min: 1,
    max: 31,
  },
  currentBalance: {
    type: Number,
    default: 0,
  },
  color: {
    type: String,
    default: '#8b5cf6',
  },
  transactions: [creditCardTransactionSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CreditCard', creditCardSchema);
