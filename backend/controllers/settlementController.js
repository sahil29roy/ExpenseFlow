const SettlementService = require('../services/settlementService');

class SettlementController {
  // Record Settlement Payment
  static async recordSettlement(req, res, next) {
    try {
      const { groupId, payerId, payeeId, amount } = req.body;
      
      // Default payerId to logged-in user if not specified
      const finalPayerId = payerId || req.user.id;

      const settlement = await SettlementService.recordSettlement({
        groupId,
        payerId: finalPayerId,
        payeeId,
        amount
      });

      res.status(201).json({
        status: 'success',
        message: 'Settlement recorded successfully',
        data: { settlement }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user settlements history
  static async getMySettlements(req, res, next) {
    try {
      const userId = req.user.id;
      const settlements = await SettlementService.getUserSettlements(userId);

      res.status(200).json({
        status: 'success',
        results: settlements.length,
        data: { settlements }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get group settlements history
  static async getGroupSettlements(req, res, next) {
    try {
      const groupId = req.params.groupId;
      const settlements = await SettlementService.getGroupSettlements(groupId);

      res.status(200).json({
        status: 'success',
        results: settlements.length,
        data: { settlements }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SettlementController;
