const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
  },
  type: {
    type: String,
    enum: ['expense', 'income'],
    default: 'expense',
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Food & Dining',
      'Transport',
      'Entertainment',
      'Shopping',
      'Health',
      'Education',
      'Housing',
      'Utilities',
      'Savings',
      'Salary',
      'Bonus',
      'Gift',
      'Other',
    ],
  },
  note: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

expenseSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
