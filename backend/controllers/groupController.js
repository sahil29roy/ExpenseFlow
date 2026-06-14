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
  // Get user groups list with optional pagination
  static async getUserGroups(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, page } = req.query;

      const parsedLimit = limit ? parseInt(limit, 10) : undefined;
      const parsedPage = page ? parseInt(page, 10) : undefined;

      let groups;
      let pagination = null;

      if (parsedLimit !== undefined && parsedPage !== undefined) {
        const offset = (parsedPage - 1) * parsedLimit;
        
        // Count total groups
        const countRes = await pool.query('SELECT COUNT(*) AS count FROM group_members WHERE user_id = $1', [userId]);
        const totalGroups = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalGroups / parsedLimit);

        groups = await GroupModel.findByUserId(userId, { limit: parsedLimit, offset });

        pagination = {
          page: parsedPage,
          limit: parsedLimit,
          totalGroups,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1
        };
      } else {
        // Fallback to retrieving all groups if pagination query is not supplied
        groups = await GroupModel.findByUserId(userId);
      }

      res.status(200).json({
        status: 'success',
        data: {
          groups,
          pagination
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Add Member to Group (Transactional, check existence and duplicates)
  static async addMember(req, res, next) {
    const client = await pool.connect();
    try {
      const groupId = req.params.id;
      const { userId } = req.body;
      const requestorId = req.user.id;

      if (!userId) {
        throw new ValidationError('userId is required');
      }

      await client.query('BEGIN');

      // 1. Verify group exists
      const group = await GroupModel.findById(groupId, client);
      if (!group) {
        throw new NotFoundError(`Group with ID ${groupId} not found`);
      }

      // 2. Verify requesting user is a member of the group
      const requestorMember = await GroupModel.isMember(groupId, requestorId, client);
      if (!requestorMember) {
        throw new ForbiddenError('Only group members can add new participants');
      }

      // 3. Verify target user exists
      const UserModel = require('../models/userModel');
      const targetUser = await UserModel.findById(userId);
      if (!targetUser) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }

      // 4. Verify target user is not already a member (duplicate check)
      const targetMember = await GroupModel.isMember(groupId, userId, client);
      if (targetMember) {
        const { ConflictError } = require('../utils/errors');
        throw new ConflictError('User is already a member of this group');
      }

      // 5. Add membership
      const membership = await GroupModel.addMember(groupId, userId, client);

      await client.query('COMMIT');

      res.status(200).json({
        status: 'success',
        message: 'Member added to group successfully',
        data: { membership }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // Remove Member from Group (Transactional, checks existence)
  static async removeMember(req, res, next) {
    const client = await pool.connect();
    try {
      const groupId = req.params.id;
      const userId = req.params.userId;
      const requestorId = req.user.id;

      await client.query('BEGIN');

      // 1. Verify group exists
      const group = await GroupModel.findById(groupId, client);
      if (!group) {
        throw new NotFoundError(`Group with ID ${groupId} not found`);
      }

      // 2. Verify requesting user is a member of the group
      const requestorMember = await GroupModel.isMember(groupId, requestorId, client);
      if (!requestorMember) {
        throw new ForbiddenError('Only group members can remove participants');
      }

      // 3. Verify target user is currently a member
      const targetMember = await GroupModel.isMember(groupId, userId, client);
      if (!targetMember) {
        throw new NotFoundError(`User with ID ${userId} is not a member of this group`);
      }

      // 4. Perform membership deletion
      await GroupModel.removeMember(groupId, userId, client);

      await client.query('COMMIT');

      res.status(200).json({
        status: 'success',
        message: 'Member removed from group successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  // List Group Members
  static async listMembers(req, res, next) {
    try {
      const groupId = req.params.id;
      const userId = req.user.id;

      // 1. Verify group exists
      const group = await GroupModel.findById(groupId);
      if (!group) {
        throw new NotFoundError(`Group with ID ${groupId} not found`);
      }

      // 2. Verify requesting user is a member of the group
      const requestorMember = await GroupModel.isMember(groupId, userId);
      if (!requestorMember) {
        throw new ForbiddenError('You are not authorized to view this group member list');
      }

      const members = await GroupModel.getMembers(groupId);

      res.status(200).json({
        status: 'success',
        results: members.length,
        data: { members }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GroupController;
