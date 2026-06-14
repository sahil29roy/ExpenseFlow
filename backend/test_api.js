const { pool, initializeDatabase } = require('./config/db');
const AuthService = require('./services/authService');
const ExpenseService = require('./services/expenseService');
const BalanceService = require('./services/balanceService');

const runTest = async () => {
  console.log('--- STARTING INTEGRATION TEST AND BALANCES VERIFICATION ---');

  try {
    // 1. Drop old tables Cascade to enforce clean UUID schemas rebuild
    console.log('Dropping old tables to rebuild UUID schemas...');
    await pool.query('DROP TABLE IF EXISTS group_members, groups, expense_splits, expenses, users CASCADE');
    
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
    const globalSettlements = await BalanceService.getGlobalSettlements();
    console.log('Settlement transactions needed to clear all debts:');
    globalSettlements.forEach(s => {
      console.log(` - ${s.from.name} pays ${s.to.name}: $${s.amount.toFixed(2)}`);
    });

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
