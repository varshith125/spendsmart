const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['Lent', 'Borrowed', 'AutoSave'], 
  },
  partyName: {
    type: String,
    required: [true, 'Person or App name is required'],
    trim: true,
  },
  principalAmount: {
    type: Number,
    required: [true, 'Principal amount is required'],
    min: [0, 'Amount must be positive'],
  },
  interestRate: {
    type: Number,
    required: [true, 'Annual interest rate is required'],
    min: [0, 'Rate cannot be negative'],
  },
  durationMonths: {
    type: Number,
    required: [true, 'Duration in months is required'],
    min: [1, 'Must be at least 1 month'],
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  paymentDay: {
    type: Number,
    required: true,
    min: [1, 'Day must be between 1 and 31'],
    max: [31, 'Day must be between 1 and 31'],
  },
  status: {
    type: String,
    enum: ['Active', 'Completed'],
    default: 'Active',
  },
  // Automatically calculated values
  monthlyEMI: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Loan', loanSchema);
