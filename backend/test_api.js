const { pool, initializeDatabase } = require('./config/db');
const AuthService = require('./services/authService');
const ExpenseService = require('./services/expenseService');
const BalanceService = require('./services/balanceService');

const runTest = async () => {
  console.log('--- STARTING INTEGRATION TEST AND BALANCES VERIFICATION ---');

  try {
    // 1. Drop old tables Cascade to enforce clean UUID schemas rebuild
    console.log('Dropping old tables to rebuild UUID schemas...');
    await pool.query('DROP TABLE IF EXISTS settlements, group_members, groups, expense_splits, expenses, users CASCADE');
    
    // 2. Initialize DB tables
    await initializeDatabase();

    // 2. Clear tables to have a clean slate for validation
    console.log('\nCleaning up database test data...');
    await pool.query('TRUNCATE TABLE group_members, groups, expense_splits, expenses, users RESTART IDENTITY CASCADE');
    console.log('Cleanup completed.');

    // 3. Register users
    console.log('\nRegistering users...');
    const aliceData = await AuthService.register({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'password123',
    });
    const bobData = await AuthService.register({
      name: 'Bob Jones',
      email: 'bob@example.com',
      password: 'password123',
    });
    const charlieData = await AuthService.register({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      password: 'password123',
    });

    const alice = aliceData.user;
    const bob = bobData.user;
    const charlie = charlieData.user;

    console.log(`Registered Users:\n - Alice (ID: ${alice.id})\n - Bob (ID: ${bob.id})\n - Charlie (ID: ${charlie.id})`);

    // --- GROUP MANAGEMENT TESTING ---
    console.log('\n--- STARTING GROUP MANAGEMENT SCENARIOS ---');
    const GroupModel = require('./models/groupModel');
    
    // Create group
    console.log('Creating group "Apartment 4B" with Alice as creator...');
    const group = await GroupModel.create({
      name: 'Apartment 4B',
      description: 'Shared room expenses',
      createdBy: alice.id,
    });
    console.log('Group created:', group);

    // Auto-membership validation
    console.log('Adding Alice as group member (auto-member simulated on controller level)...');
    await GroupModel.addMember(group.id, alice.id);

    // Check members list
    let members = await GroupModel.getMembers(group.id);
    console.log('Members list after creation (Alice):', members.map(m => m.name));

    // Add Bob
    console.log('Adding Bob to the group...');
    await GroupModel.addMember(group.id, bob.id);
    members = await GroupModel.getMembers(group.id);
    console.log('Members list after adding Bob:', members.map(m => m.name));

    // Remove Bob (verify removal works)
    console.log('Removing Bob from the group...');
    await GroupModel.removeMember(group.id, bob.id);
    members = await GroupModel.getMembers(group.id);
    console.log('Members list after removing Bob:', members.map(m => m.name));

    // Re-add Bob for rest of the tests if needed
    console.log('Re-adding Bob to keep him in subsequent test scenarios...');
    await GroupModel.addMember(group.id, bob.id);

    // Get user groups list
    const aliceGroups = await GroupModel.findByUserId(alice.id);
    console.log('Alice groups memberships list:', aliceGroups.map(g => g.name));

    // Update group details
    console.log('Updating group title to "Co-living Apartment 4B"...');
    const updated = await GroupModel.update(group.id, {
      name: 'Co-living Apartment 4B',
      description: 'Splitting utility and rent invoices',
    });
    console.log('Group details updated:', updated);

    // Create a temporary group to test deletion
    console.log('Creating temporary group to test deletion...');
    const tempGroup = await GroupModel.create({
      name: 'Temp Project Group',
      createdBy: alice.id
    });
    console.log('Deleting temporary group...');
    const deleted = await GroupModel.delete(tempGroup.id);
    console.log('Deleted group ID:', deleted.id);
    console.log('--- GROUP MANAGEMENT SCENARIOS COMPLETED ---');

    console.log('\n--- STARTING GROUP EXPENSE VALIDATIONS ---');
    // Test Group Expense Creation: Payer and all participants are group members (Alice and Bob)
    console.log('1. Creating group expense: Payer Alice, participants Alice and Bob (Should Succeed)');
    const groupExp = await ExpenseService.createExpense({
      description: 'Living room rug',
      totalAmount: 120.00,
      paidBy: alice.id,
      splitType: 'UNEQUAL',
      groupId: group.id,
      participants: [
        { userId: alice.id, amount: 40.00 },
        { userId: bob.id, amount: 80.00 }
      ]
    });
    console.log('Group expense created successfully:', groupExp.description, 'ID:', groupExp.id);

    // Test Group Expense Creation: Payer belongs to group, but one participant (Charlie) does not (Should Fail)
    console.log('2. Creating group expense with non-member Charlie as participant (Should Fail)');
    try {
      await ExpenseService.createExpense({
        description: 'Internet invoice',
        totalAmount: 90.00,
        paidBy: alice.id,
        splitType: 'EQUAL',
        groupId: group.id,
        participants: [
          { userId: alice.id },
          { userId: bob.id },
          { userId: charlie.id } // Charlie is not a member of Apartment 4B!
        ]
      });
      console.error('ERROR: Expense creation succeeded but should have failed!');
    } catch (err) {
      console.log('SUCCESSFUL FAILURE CHECK:', err.message); // Should print participant is not a member
    }

    // Test Group Expense Creation: Payer (Charlie) does not belong to group (Should Fail)
    console.log('3. Creating group expense where payer Charlie is not a member (Should Fail)');
    try {
      await ExpenseService.createExpense({
        description: 'New toaster',
        totalAmount: 30.00,
        paidBy: charlie.id,
        splitType: 'EQUAL',
        groupId: group.id,
        participants: [
          { userId: alice.id },
          { userId: bob.id }
        ]
      });
      console.error('ERROR: Expense creation succeeded but should have failed!');
    } catch (err) {
      console.log('SUCCESSFUL FAILURE CHECK:', err.message); // Should print payer is not a member
    }
    console.log('--- GROUP EXPENSE VALIDATIONS COMPLETED ---');

    // 4. Create Expenses
    console.log('\nCreating test expenses...');

    // Expense 1: Alice paid $300, split EQUALLY between Alice, Bob, and Charlie
    console.log('\n1. Creating Expense: EQUAL split (Alice pays $300.00)');
    const exp1 = await ExpenseService.createExpense({
      description: 'Group Dinner',
      totalAmount: 300.00,
      paidBy: alice.id,
      splitType: 'EQUAL',
      participants: [
        { userId: alice.id },
        { userId: bob.id },
        { userId: charlie.id },
      ],
    });
    console.log('Expense 1 splits created:', exp1.splits.map(s => `User ${s.user_id}: $${s.amount}`));

    // Expense 2: Bob paid $90, split EXACTLY: Bob ($30), Charlie ($60)
    console.log('\n2. Creating Expense: EXACT split (Bob pays $90.00)');
    const exp2 = await ExpenseService.createExpense({
      description: 'Movie Tickets & Snacks',
      totalAmount: 90.00,
      paidBy: bob.id,
      splitType: 'EXACT',
      participants: [
        { userId: bob.id, amount: 30.00 },
        { userId: charlie.id, amount: 60.00 },
      ],
    });
    console.log('Expense 2 splits created:', exp2.splits.map(s => `User ${s.user_id}: $${s.amount}`));

    // Expense 3: Charlie paid $100, split by PERCENTAGE: Alice (20%), Bob (30%), Charlie (50%)
    console.log('\n3. Creating Expense: PERCENTAGE split (Charlie pays $100.00)');
    const exp3 = await ExpenseService.createExpense({
      description: 'Co-working utilities',
      totalAmount: 100.00,
      paidBy: charlie.id,
      splitType: 'PERCENTAGE',
      participants: [
        { userId: alice.id, percentage: 20 },
        { userId: bob.id, percentage: 30 },
        { userId: charlie.id, percentage: 50 },
      ],
    });
    console.log('Expense 3 splits created:', exp3.splits.map(s => `User ${s.user_id}: $${s.amount} (${s.percentage}%)`));

    // 5. Query individual and global balances
    console.log('\n--- VERIFYING INDIVIDUAL BALANCES ---');
    
    const aliceBalances = await BalanceService.getUserBalances(alice.id);
    const bobBalances = await BalanceService.getUserBalances(bob.id);
    const charlieBalances = await BalanceService.getUserBalances(charlie.id);

    console.log('\nAlice Balance Summary:', aliceBalances.summary);
    console.log('Alice owes:', aliceBalances.owes);
    console.log('Alice is owed by:', aliceBalances.owedBy);

    console.log('\nBob Balance Summary:', bobBalances.summary);
    console.log('Bob owes:', bobBalances.owes);
    console.log('Bob is owed by:', bobBalances.owedBy);

    console.log('\nCharlie Balance Summary:', charlieBalances.summary);
    console.log('Charlie owes:', charlieBalances.owes);
    console.log('Charlie is owed by:', charlieBalances.owedBy);

    console.log('\n--- VERIFYING GLOBAL SIMPLIFIED SETTLEMENTS ---');
    let globalSettlements = await BalanceService.getGlobalSettlements();
    console.log('Settlement transactions needed to clear all debts:');
    globalSettlements.forEach(s => {
      console.log(` - ${s.from.name} pays ${s.to.name}: $${s.amount.toFixed(2)}`);
    });

    console.log('\n--- STARTING SETTLEMENT PERSISTENCE AND BALANCE OFFSET TESTING ---');
    const SettlementService = require('./services/settlementService');

    // Bob settles $50.00 with Alice (out of the $150.00 debt Bob owes Alice globally)
    console.log('Recording settlement: Bob pays Alice $50.00...');
    const settle1 = await SettlementService.recordSettlement({
      groupId: group.id,
      payerId: bob.id,
      payeeId: alice.id,
      amount: 50.00
    });
    console.log('Settlement record saved in DB:', settle1);

    // Verify balances update dynamically!
    console.log('\nChecking Alice balances after Bob settled $50.00...');
    const aliceBalancesAfter = await BalanceService.getUserBalances(alice.id);
    console.log('Alice Balance Summary (Total Paid should be 420.00, Owed should be 120 + 50 = 170.00, Net should be 250.00):');
    console.log(aliceBalancesAfter.summary);
    console.log('Alice is owed by Bob (should be $100.00 instead of $150.00):', aliceBalancesAfter.owedBy);

    console.log('\nChecking Bob balances after settling $50.00...');
    const bobBalancesAfter = await BalanceService.getUserBalances(bob.id);
    console.log('Bob Balance Summary (Total Paid should be 90 + 50 = 140.00, Owed should be 240.00, Net should be -100.00):');
    console.log(bobBalancesAfter.summary);

    // Verify global settlements decreases B pays A from $150.00 to $100.00
    console.log('\nRe-evaluating global simplified settlements...');
    globalSettlements = await BalanceService.getGlobalSettlements();
    console.log('New simplified settlements recommended:');
    globalSettlements.forEach(s => {
      console.log(` - ${s.from.name} pays ${s.to.name}: $${s.amount.toFixed(2)}`);
    });
    console.log('--- SETTLEMENT PERSISTENCE TESTING COMPLETED ---');

    console.log('\n--- STARTING DASHBOARD METRICS AND PAGINATION TESTING ---');
    const DashboardService = require('./services/dashboardService');

    // Retrieve Alice's dashboard (page 1, limit 2)
    console.log('Retrieving dashboard for Alice (page 1, limit 2)...');
    const aliceDashboard = await DashboardService.getUserDashboard(alice.id, { limit: 2, page: 1 });
    console.log('Alice Dashboard Metrics:', aliceDashboard.metrics);
    console.log('Alice Recent Expenses count (should be 2):', aliceDashboard.recentExpenses.length);
    console.log('Pagination Metadata:', aliceDashboard.pagination);

    // Retrieve Alice's dashboard (page 2, limit 2)
    console.log('Retrieving dashboard for Alice (page 2, limit 2)...');
    const aliceDashboardPage2 = await DashboardService.getUserDashboard(alice.id, { limit: 2, page: 2 });
    console.log('Alice Recent Expenses count page 2:', aliceDashboardPage2.recentExpenses.length);
    console.log('Pagination Metadata page 2:', aliceDashboardPage2.pagination);
    console.log('--- DASHBOARD METRICS TESTING COMPLETED ---');

    console.log('\n--- STARTING CSV IMPORT AND TRANSACTION VERIFICATION ---');
    const CsvImportService = require('./services/csvImportService');

    // Create a mock valid CSV file string buffer
    const validCsvContent = 
`date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
2026-06-14,CSV Pizza Night,alice@example.com,60.00,USD,EQUAL,"alice@example.com,bob@example.com",,Extra cheese
2026-06-14,CSV Shared Cab,bob@example.com,40.00,USD,PERCENTAGE,"alice@example.com,bob@example.com","25,75",
2026-06-14,CSV Concert tickets,charlie@example.com,150.00,USD,UNEQUAL,"alice@example.com,bob@example.com,charlie@example.com","50,50,50",
`;
    const validCsvBuffer = Buffer.from(validCsvContent, 'utf-8');

    console.log('Triggering CSV import with valid contents...');
    const importResult = await CsvImportService.importExpenses(validCsvBuffer);
    console.log('Import Status:', importResult.success);
    console.log('Import Message:', importResult.message);
    console.log('Import Report:', importResult.report);

    // Create a mock invalid CSV containing an invalid user email (triggers rollback)
    const invalidCsvContent = 
`date,description,paid_by,amount,currency,split_type,split_with,split_details,notes
2026-06-14,CSV Valid item,alice@example.com,30.00,USD,EQUAL,"alice@example.com,bob@example.com",,
2026-06-14,CSV Invalid item,alice@example.com,20.00,USD,EQUAL,"non_existent@example.com,bob@example.com",,
`;
    const invalidCsvBuffer = Buffer.from(invalidCsvContent, 'utf-8');

    console.log('\nTriggering CSV import containing invalid emails (Should Fail and Rollback)...');
    const invalidResult = await CsvImportService.importExpenses(invalidCsvBuffer);
    console.log('Import Status (Should be false):', invalidResult.success);
    console.log('Import Message:', invalidResult.message);
    console.log('Validation Errors found:', invalidResult.report.errors);

    // Double check that the valid item in the invalid CSV was NOT saved in database (rollback verification)
    const finalExpensesCheck = await pool.query("SELECT COUNT(*) FROM expenses WHERE description = 'CSV Valid item'");
    console.log('Count of "CSV Valid item" in database (should be 0 due to atomic rollback):', parseInt(finalExpensesCheck.rows[0].count, 10));
    console.log('--- CSV IMPORT AND TRANSACTION TESTING COMPLETED ---');

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    // Terminate DB pool connection so the process exits cleanly
    await pool.end();
    console.log('Database pool connection terminated.');
  }
};

runTest();
