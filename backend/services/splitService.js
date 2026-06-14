const SplitCalculator = require('../utils/splitCalculator');

class SplitService {
  /**
   * Calculates equal splits among participants with decimal precision adjustment.
   */
  static calculateEqualSplit({ totalAmount, participants }) {
    return SplitCalculator.calculateEqualSplits(Number(totalAmount), participants);
  }

  /**
   * Validates and calculates unequal (exact amount) splits.
   */
  static calculateUnequalSplit({ totalAmount, participants }) {
    return SplitCalculator.calculateExactSplits(Number(totalAmount), participants);
  }

  /**
   * Calculates percentage splits and resolves decimal rounding differences.
   */
  static calculatePercentageSplit({ totalAmount, participants }) {
    return SplitCalculator.calculatePercentageSplits(Number(totalAmount), participants);
  }
}

module.exports = SplitService;
