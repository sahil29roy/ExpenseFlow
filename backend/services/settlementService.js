const { pool } = require('../config/db');
const SettlementModel = require('../models/settlementModel');
const UserModel = require('../models/userModel');
const { NotFoundError, ValidationError } = require('../utils/errors');

class SettlementService {
  /**
   * Records a manual debt settlement payment between users inside a transaction
   */
  static async recordSettlement({ groupId, payerId, payeeId, amount }) {
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new ValidationError('Settlement amount must be a number greater than 0');
    }

    if (payerId === payeeId) {
      throw new ValidationError('A user cannot record a settlement payment to themselves');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Validate payer exists
      const payer = await UserModel.findById(payerId);
      if (!payer) {
        throw new NotFoundError(`Payer with ID ${payerId} not found`);
      }

      // 2. Validate payee exists
      const payee = await UserModel.findById(payeeId);
      if (!payee) {
        throw new NotFoundError(`Payee with ID ${payeeId} not found`);
      }

      // 3. Validate group exists if groupId is provided
      if (groupId) {
        const GroupModel = require('../models/groupModel');
        const group = await GroupModel.findById(groupId, client);
        if (!group) {
          throw new NotFoundError(`Group with ID ${groupId} not found`);
        }

        // Validate both are members of the group
        const isPayerMember = await GroupModel.isMember(groupId, payerId, client);
        const isPayeeMember = await GroupModel.isMember(groupId, payeeId, client);
        
        if (!isPayerMember || !isPayeeMember) {
          const { ForbiddenError } = require('../utils/errors');
          throw new ForbiddenError('Both settlement participants must belong to the group');
        }
      }

      // 4. Record settlement
      const settlement = await SettlementModel.create({
        groupId,
        payerId,
        payeeId,
        amount: amt
      }, client);

      await client.query('COMMIT');

      return settlement;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getGroupSettlements(groupId) {
    return SettlementModel.getByGroupId(groupId);
  }

  static async getUserSettlements(userId) {
    return SettlementModel.getByUserId(userId);
  }
}

module.exports = SettlementService;
