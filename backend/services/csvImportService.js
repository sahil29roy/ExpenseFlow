const csv = require('csv-parser');
const { Readable } = require('stream');
const { pool } = require('../config/db');
const UserModel = require('../models/userModel');
const ExpenseService = require('./expenseService');
const { ValidationError } = require('../utils/errors');

class CsvImportService {
  /**
   * Parses and imports expenses from a CSV file buffer inside a single atomic transaction.
   */
  static async importExpenses(fileBuffer) {
    const rows = [];
    const report = {
      totalRows: 0,
      importedCount: 0,
      failedCount: 0,
      errors: [], // List of { rowNum, error }
    };

    // 1. Parse CSV from buffer using stream
    await new Promise((resolve, reject) => {
      const stream = Readable.from(fileBuffer);
      stream
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    report.totalRows = rows.length;
    if (rows.length === 0) {
      throw new ValidationError('The uploaded CSV file is empty');
    }

    // 2. Perform email resolution cache to avoid redundant database queries
    const emailCache = new Map();
    const resolveUserByEmail = async (email) => {
      const cleanEmail = email.trim().toLowerCase();
      if (emailCache.has(cleanEmail)) {
        return emailCache.get(cleanEmail);
      }
      const user = await UserModel.findByEmail(cleanEmail);
      if (user) {
        emailCache.set(cleanEmail, user);
      }
      return user;
    };

    // 3. Dry-run Validation Phase (accumulate validation errors before database writes)
    const validExpensesData = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const row = rows[i];
      
      try {
        // Required fields
        if (!row.description || !row.paid_by || !row.amount || !row.split_type || !row.split_with) {
          throw new Error('Missing required columns. Required: description, paid_by, amount, split_type, split_with');
        }

        const totalAmount = parseFloat(row.amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
          throw new Error(`Invalid amount: ${row.amount}. Must be greater than 0.`);
        }

        const splitType = row.split_type.toUpperCase().trim();
        if (!['EQUAL', 'EXACT', 'PERCENTAGE', 'UNEQUAL'].includes(splitType)) {
          throw new Error(`Unsupported split type: ${row.split_type}. Must be EQUAL, UNEQUAL, EXACT, or PERCENTAGE.`);
        }

        // Resolve Payer
        const payer = await resolveUserByEmail(row.paid_by);
        if (!payer) {
          throw new Error(`Payer email "${row.paid_by}" not found in database.`);
        }

        // Resolve Participants
        const participantEmails = row.split_with.split(',').map(e => e.trim().toLowerCase());
        const participantsData = [];
        
        // Parse split details values if UNEQUAL/EXACT or PERCENTAGE
        const splitValues = row.split_details ? row.split_details.split(',').map(v => parseFloat(v.trim())) : [];

        for (let idx = 0; idx < participantEmails.length; idx++) {
          const email = participantEmails[idx];
          const participant = await resolveUserByEmail(email);
          if (!participant) {
            throw new Error(`Participant email "${email}" not found in database.`);
          }

          const participantItem = { userId: participant.id };

          if (splitType === 'EXACT' || splitType === 'UNEQUAL') {
            const amountVal = splitValues[idx];
            if (isNaN(amountVal) || amountVal < 0) {
              throw new Error(`Missing or invalid exact split amount value for participant "${email}".`);
            }
            participantItem.amount = amountVal;
          } else if (splitType === 'PERCENTAGE') {
            const percentVal = splitValues[idx];
            if (isNaN(percentVal) || percentVal < 0 || percentVal > 100) {
              throw new Error(`Missing or invalid split percentage value for participant "${email}".`);
            }
            participantItem.percentage = percentVal;
          }

          participantsData.push(participantItem);
        }

        // Optional notes can be appended to the description
        let finalDescription = row.description.trim();
        if (row.notes && row.notes.trim() !== '') {
          finalDescription += ` (${row.notes.trim()})`;
        }

        validExpensesData.push({
          description: finalDescription,
          totalAmount,
          paidBy: payer.id,
          splitType,
          participants: participantsData,
        });

      } catch (err) {
        report.failedCount++;
        report.errors.push({
          rowNum,
          error: err.message,
        });
      }
    }

    // 4. Database Transaction Phase (if no validation errors, save atomic records)
    if (report.failedCount > 0) {
      // Return validation report without saving if there are layout/data errors
      return {
        success: false,
        message: 'CSV import aborted due to validation errors. Correct them and retry.',
        report,
      };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const expenseData of validExpensesData) {
        // Reuse expense transaction service inside transaction block
        // Passing the client directly enforces transaction sharing
        await ExpenseService.createExpense(expenseData, client);
        report.importedCount++;
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: `Successfully imported all ${report.importedCount} expenses.`,
        report,
      };
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  }
}

module.exports = CsvImportService;
