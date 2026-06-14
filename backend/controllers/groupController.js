const GroupModel = require('../models/groupModel');
const { pool } = require('../config/db');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');

class GroupController {
  // Create Group (Transactions: Creator automatically becomes member)
  static async createGroup(req, res, next) {
    const client = await pool.connect();
    try {
      const { name, description } = req.body;
      const creatorId = req.user.id;

      await client.query('BEGIN');

      // 1. Create the Group record
      const group = await GroupModel.create({
        name,
        description,
        createdBy: creatorId
      }, client);

      // 2. Add the creator as the first member
      await GroupModel.addMember(group.id, creatorId, client);

      await client.query('COMMIT');

      res.status(201).json({
        status: 'success',
        message: 'Group created successfully',
        data: { group }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Update Group details (Only members can update group details)
  static async updateGroup(req, res, next) {
    try {
      const groupId = req.params.id;
      const { name, description } = req.body;
      const userId = req.user.id;

      // Check if group exists
      const group = await GroupModel.findById(groupId);
      if (!group) {
        throw new NotFoundError(`Group with ID ${groupId} not found`);
      }

      // Check if the user is a member of this group
      const members = await GroupModel.getMembers(groupId);
      const isMember = members.some(m => m.id === userId);
      if (!isMember) {
        throw new ForbiddenError('You can only update details of groups you belong to');
      }

      const updatedGroup = await GroupModel.update(groupId, { name, description });

      res.status(200).json({
        status: 'success',
        message: 'Group updated successfully',
        data: { group: updatedGroup }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete Group (Only creator can delete)
  static async deleteGroup(req, res, next) {
    try {
      const groupId = req.params.id;
      const userId = req.user.id;

      // Check if group exists
      const group = await GroupModel.findById(groupId);
      if (!group) {
        throw new NotFoundError(`Group with ID ${groupId} not found`);
      }

      // ONLY the creator can delete the group
      if (group.created_by !== userId) {
        throw new ForbiddenError('Only the group creator is authorized to delete this group');
      }

      await GroupModel.delete(groupId);

      res.status(200).json({
        status: 'success',
        message: 'Group deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single group details with members
  static async getGroupDetails(req, res, next) {
    try {
      const groupId = req.params.id;
      const userId = req.user.id;

      const group = await GroupModel.findById(groupId);
      if (!group) {
        throw new NotFoundError(`Group with ID ${groupId} not found`);
      }

      // Ensure the requesting user is a member of the group
      const members = await GroupModel.getMembers(groupId);
      const isMember = members.some(m => m.id === userId);
      if (!isMember) {
        throw new ForbiddenError('You are not authorized to view this group details');
      }

      res.status(200).json({
        status: 'success',
        data: {
          group,
          members
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user groups list
  static async getUserGroups(req, res, next) {
    try {
      const userId = req.user.id;
      const groups = await GroupModel.findByUserId(userId);

      res.status(200).json({
        status: 'success',
        results: groups.length,
        data: { groups }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GroupController;
