const DashboardService = require('../services/dashboardService');

class DashboardController {
  static async getDashboard(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, page } = req.query;

      const dashboardData = await DashboardService.getUserDashboard(userId, {
        limit: limit || 5,
        page: page || 1
      });

      res.status(200).json({
        status: 'success',
        data: dashboardData
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
