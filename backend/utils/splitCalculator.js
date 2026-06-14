const { ValidationError } = require('./errors');

class SplitCalculator {
  /**
   * Validates and calculates splits based on type.
   * Returns array of splits: { userId, amount, percentage }
   */
  static calculateSplits({ totalAmount, splitType, participants, paidBy }) {
    const total = Number(totalAmount);
    if (isNaN(total) || total <= 0) {
      throw new ValidationError('Total amount must be a number greater than 0');
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      throw new ValidationError('At least one participant is required for splitting the expense');
    }

    // Ensure user ids are distinct
    const distinctUsers = new Set(participants.map(p => p.userId));
    if (distinctUsers.size !== participants.length) {
      throw new ValidationError('Participants must contain unique user IDs');
    }

    let calculatedSplits = [];

    switch (splitType.toUpperCase()) {
      case 'EQUAL':
        calculatedSplits = this.calculateEqualSplits(total, participants);
        break;
      case 'EXACT':
        calculatedSplits = this.calculateExactSplits(total, participants);
        break;
      case 'PERCENTAGE':
        calculatedSplits = this.calculatePercentageSplits(total, participants);
        break;
      default:
        throw new ValidationError(`Invalid split type: ${splitType}. Must be EQUAL, EXACT, or PERCENTAGE.`);
    }

    return calculatedSplits;
  }

  static calculateEqualSplits(total, participants) {
    const count = participants.length;
    const baseSplit = Number((total / count).toFixed(2));
    const calculatedSplits = [];

    let sumOfSplits = 0;
    for (let i = 0; i < count; i++) {
      calculatedSplits.push({
        userId: participants[i].userId,
        amount: baseSplit,
        percentage: Number((100 / count).toFixed(2)),
      });
      sumOfSplits += baseSplit;
    }

    // Handle rounding remainder
    let remainder = Number((total - sumOfSplits).toFixed(2));
    if (remainder !== 0) {
      // Add or subtract 0.01 from splits until remainder is resolved
      const step = remainder > 0 ? 0.01 : -0.01;
      let i = 0;
      while (Math.abs(remainder) > 0.001) {
        calculatedSplits[i].amount = Number((calculatedSplits[i].amount + step).toFixed(2));
        remainder = Number((remainder - step).toFixed(2));
        i = (i + 1) % count;
      }
    }

    return calculatedSplits;
  }

  static calculateExactSplits(total, participants) {
    const calculatedSplits = [];
    let sumOfSplits = 0;

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const amount = Number(p.amount);
      if (isNaN(amount) || amount < 0) {
        throw new ValidationError(`Exact amount for user ${p.userId} must be a non-negative number`);
      }

      calculatedSplits.push({
        userId: p.userId,
        amount: amount,
        percentage: null, // Exact split does not rely on percentages explicitly
      });
      sumOfSplits += amount;
    }

    // Verify sum equals total
    if (Math.abs(sumOfSplits - total) > 0.01) {
      throw new ValidationError(`Sum of exact splits (${sumOfSplits.toFixed(2)}) must equal the total amount (${total.toFixed(2)})`);
    }

    return calculatedSplits;
  }

  static calculatePercentageSplits(total, participants) {
    const calculatedSplits = [];
    let sumOfPercentages = 0;
    let sumOfCalculatedAmounts = 0;

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const percent = Number(p.percentage);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        throw new ValidationError(`Percentage for user ${p.userId} must be between 0 and 100`);
      }

      const calculatedAmount = Number((total * (percent / 100)).toFixed(2));

      calculatedSplits.push({
        userId: p.userId,
        amount: calculatedAmount,
        percentage: percent,
      });

      sumOfPercentages += percent;
      sumOfCalculatedAmounts += calculatedAmount;
    }

    // Verify sum of percentages is exactly 100%
    if (Math.abs(sumOfPercentages - 100) > 0.01) {
      throw new ValidationError(`Sum of percentages (${sumOfPercentages}%) must equal exactly 100%`);
    }

    // Handle rounding remainder on calculated amount
    let remainder = Number((total - sumOfCalculatedAmounts).toFixed(2));
    if (remainder !== 0) {
      // Add remainder to the first participant with non-zero percentage
      const target = calculatedSplits.find(s => s.percentage > 0);
      if (target) {
        target.amount = Number((target.amount + remainder).toFixed(2));
      }
    }

    return calculatedSplits;
  }
}

module.exports = SplitCalculator;
