
import ActualClient from './src/actual-client.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const config = {
        dataDir: process.env.ACTUAL_DATA_DIR || './data',
        serverURL: process.env.ACTUAL_SERVER_URL,
        password: process.env.ACTUAL_PASSWORD,
    };

    const client = new ActualClient(config);
    try {
        console.log('Fetching budgets...');
        const budgets = await client.getBudgets();
        console.log('Budgets found:', budgets.length);
        if (budgets.length > 0) {
            console.log('First budget structure:', JSON.stringify(budgets[0], null, 2));
        }

        budgets.forEach(b => {
            const id = b.id || b.syncId;
            console.log(`Name: ${b.name}, ID (id || syncId): ${id}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.shutdown();
    }
}

run();
