const CsvImportService = require('../services/csvImportService');
const { ValidationError } = require('../utils/errors');

class CsvImportController {
  static async importCsv(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError('No CSV file uploaded. Please upload a file with field name "file"');
      }

      const result = await CsvImportService.importExpenses(req.file.buffer);

      if (result.success) {
        res.status(200).json({
          status: 'success',
          message: result.message,
          data: result.report
        });
      } else {
        res.status(400).json({
          status: 'fail',
          message: result.message,
          data: result.report
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CsvImportController;
