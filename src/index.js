#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import cron from 'node-cron';
import PortfolioManager from './portfolio-manager.js';

// Load environment variables
dotenv.config();

const program = new Command();

// Configuration
const config = {
    dataDir: process.env.ACTUAL_DATA_DIR || './data',
    exchangeSuffix: process.env.STOCK_EXCHANGE_SUFFIX || '.SW'
};

const portfolioFile = process.env.PORTFOLIO_FILE || './portfolio.json';
const updateInterval = parseInt(process.env.UPDATE_INTERVAL_MINUTES || '60', 10);

program
    .name('helvetfolio')
    .description('Helvetfolio — Stock portfolio for Actual Budget')
    .version('1.0.0');

// Add stock command
program
    .command('add <ticker> <quantity>')
    .description('Add a Swiss stock to your portfolio')
    .option('-d, --date <date>', 'Purchase date (YYYY-MM-DD), e.g., 2020-03-15')
    .option('-p, --price <price>', 'Purchase price per share')
    .action(async (ticker, quantity, options) => {
        const manager = new PortfolioManager(portfolioFile, config);

        try {
            console.log(chalk.blue(`Adding ${ticker} with ${quantity} shares...`));

            const addOptions = {};
            if (options.date) {
                addOptions.purchaseDate = options.date;
            }
            if (options.price) {
                addOptions.purchasePrice = parseFloat(options.price);
            }

            const stock = await manager.addStock(ticker, parseFloat(quantity), addOptions);

            console.log(chalk.green('✓ Stock added successfully!'));
            console.log(chalk.white(`  Ticker: ${stock.ticker}`));
            console.log(chalk.white(`  Name: ${stock.name}`));
            console.log(chalk.white(`  Quantity: ${stock.quantity}`));
            if (stock.purchaseDate) {
                console.log(chalk.white(`  Purchase Date: ${stock.purchaseDate}`));
            }
            if (stock.purchasePrice) {
                console.log(chalk.white(`  Purchase Price: ${stock.purchasePrice} ${stock.currency}`));
                console.log(chalk.white(`  Cost Basis: ${stock.costBasis.toFixed(2)} ${stock.currency}`));
            }
            console.log(chalk.white(`  Current Price: ${stock.lastPrice} ${stock.currency}`));
            console.log(chalk.white(`  Current Value: ${(stock.quantity * stock.lastPrice).toFixed(2)} ${stock.currency}`));
            console.log(chalk.white(`  Account ID: ${stock.accountId}`));
        } catch (error) {
            console.error(chalk.red('✗ Error:'), error.message);
            process.exit(1);
        } finally {
            await manager.shutdown();
        }
    });

// Remove stock command
program
    .command('remove <ticker>')
    .description('Remove a stock from your portfolio')
    .action(async (ticker) => {
        const manager = new PortfolioManager(portfolioFile, config);

        try {
            console.log(chalk.blue(`Removing ${ticker}...`));

            await manager.removeStock(ticker);

            console.log(chalk.green('✓ Stock removed successfully!'));
        } catch (error) {
            console.error(chalk.red('✗ Error:'), error.message);
            process.exit(1);
        } finally {
            await manager.shutdown();
        }
    });

// Update prices command
program
    .command('update')
    .description('Update all stock prices and sync with Actual Budget')
    .action(async () => {
        const manager = new PortfolioManager(portfolioFile, config);

        try {
            console.log(chalk.blue('Updating stock prices...'));

            const updates = await manager.updateAllPrices();

            if (updates.length === 0) {
                console.log(chalk.yellow('No stocks in portfolio'));
                return;
            }

            console.log(chalk.green(`\n✓ Updated ${updates.length} stocks:\n`));

            updates.forEach(update => {
                if (update.success) {
                    console.log(chalk.white(`  ${update.ticker} (${update.name})`));
                    console.log(chalk.white(`    Quantity: ${update.quantity}`));
                    console.log(chalk.white(`    Price: ${update.price.toFixed(2)} ${update.currency}`));
                    console.log(chalk.white(`    Value: ${update.value.toFixed(2)} ${update.currency}`));
                    console.log();
                } else {
                    console.log(chalk.red(`  ${update.ticker}: ${update.error}`));
                    console.log();
                }
            });

            const totalValue = updates
                .filter(u => u.success)
                .reduce((sum, u) => sum + u.value, 0);

            console.log(chalk.green(`Total Portfolio Value: ${totalValue.toFixed(2)} CHF`));
        } catch (error) {
            console.error(chalk.red('✗ Error:'), error.message);
            process.exit(1);
        } finally {
            await manager.shutdown();
        }
    });

// List portfolio command
program
    .command('list')
    .description('List all stocks in your portfolio')
    .action(async () => {
        const manager = new PortfolioManager(portfolioFile, config);

        try {
            const summary = await manager.getPortfolioSummary();

            if (summary.totalStocks === 0) {
                console.log(chalk.yellow('Portfolio is empty'));
                return;
            }

            console.log(chalk.blue(`\nPortfolio (${summary.totalStocks} stocks):\n`));

            summary.stocks.forEach(stock => {
                console.log(chalk.white(`  ${stock.ticker} - ${stock.name}`));
                console.log(chalk.white(`    Quantity: ${stock.quantity}`));
                console.log(chalk.white(`    Last Price: ${stock.lastPrice.toFixed(2)} ${stock.currency}`));
                console.log(chalk.white(`    Value: ${stock.value.toFixed(2)} ${stock.currency}`));
                console.log(chalk.white(`    Last Updated: ${new Date(stock.lastUpdated).toLocaleString()}`));
                console.log();
            });

            console.log(chalk.green(`Total Value: ${summary.totalValue.toFixed(2)} CHF`));
        } catch (error) {
            console.error(chalk.red('✗ Error:'), error.message);
            process.exit(1);
        } finally {
            await manager.shutdown();
        }
    });

// Performance command
program
    .command('performance')
    .description('Show portfolio performance with gains/losses')
    .action(async () => {
        const manager = new PortfolioManager(portfolioFile, config);

        try {
            const performance = await manager.getPortfolioWithPerformance();

            if (performance.totalStocks === 0) {
                console.log(chalk.yellow('Portfolio is empty'));
                return;
            }

            console.log(chalk.blue(`\n📊 Portfolio Performance (${performance.totalStocks} stocks):\n`));

            performance.stocks.forEach(stock => {
                const gainColor = stock.gain >= 0 ? chalk.green : chalk.red;
                const gainSign = stock.gain >= 0 ? '+' : '';

                console.log(chalk.white(`  ${stock.ticker} - ${stock.name}`));
                console.log(chalk.white(`    Quantity: ${stock.quantity}`));
                if (stock.purchaseDate) {
                    console.log(chalk.white(`    Purchase Date: ${stock.purchaseDate}`));
                }
                console.log(chalk.white(`    Purchase Price: ${stock.purchasePrice.toFixed(2)} ${stock.currency}`));
                console.log(chalk.white(`    Cost Basis: ${stock.costBasis.toFixed(2)} ${stock.currency}`));
                console.log(chalk.white(`    Current Price: ${stock.currentPrice.toFixed(2)} ${stock.currency}`));
                console.log(chalk.white(`    Current Value: ${stock.currentValue.toFixed(2)} ${stock.currency}`));
                console.log(gainColor(`    Gain/Loss: ${gainSign}${stock.gain.toFixed(2)} ${stock.currency} (${gainSign}${stock.gainPercent.toFixed(2)}%)`));
                console.log(chalk.white(`    Last Updated: ${new Date(stock.lastUpdated).toLocaleString()}`));
                console.log();
            });

            const totalGainColor = performance.totalGain >= 0 ? chalk.green : chalk.red;
            const totalGainSign = performance.totalGain >= 0 ? '+' : '';

            console.log(chalk.blue('📈 Total Portfolio:'));
            console.log(chalk.white(`  Total Cost Basis: ${performance.totalCostBasis.toFixed(2)} CHF`));
            console.log(chalk.white(`  Current Value: ${performance.totalValue.toFixed(2)} CHF`));
            console.log(totalGainColor(`  Total Gain/Loss: ${totalGainSign}${performance.totalGain.toFixed(2)} CHF (${totalGainSign}${performance.totalGainPercent.toFixed(2)}%)`));
        } catch (error) {
            console.error(chalk.red('✗ Error:'), error.message);
            process.exit(1);
        } finally {
            await manager.shutdown();
        }
    });

// Update quantity command
program
    .command('set-quantity <ticker> <quantity>')
    .description('Update the quantity for an existing stock')
    .action(async (ticker, quantity) => {
        const manager = new PortfolioManager(portfolioFile, config);

        try {
            console.log(chalk.blue(`Updating quantity for ${ticker}...`));

            const stock = await manager.updateQuantity(ticker, parseFloat(quantity));

            console.log(chalk.green('✓ Quantity updated successfully!'));
            console.log(chalk.white(`  Ticker: ${stock.ticker}`));
            console.log(chalk.white(`  New Quantity: ${stock.quantity}`));
            console.log(chalk.white(`  Price: ${stock.lastPrice} ${stock.currency}`));
            console.log(chalk.white(`  New Value: ${(stock.quantity * stock.lastPrice).toFixed(2)} ${stock.currency}`));
        } catch (error) {
            console.error(chalk.red('✗ Error:'), error.message);
            process.exit(1);
        } finally {
            await manager.shutdown();
        }
    });

// Start daemon command
program
    .command('start-daemon')
    .description('Start background service to automatically update prices')
    .action(async () => {
        console.log(chalk.blue(`Starting daemon with ${updateInterval} minute update interval...`));
        console.log(chalk.white('Press Ctrl+C to stop\n'));

        const manager = new PortfolioManager(portfolioFile, config);

        // Function to update prices
        const updatePrices = async () => {
            try {
                // Ensure latest settings are loaded
                await manager.loadPortfolio();

                if (!manager.actualConfig.serverURL || !manager.actualConfig.budgetId) {
                    console.log(chalk.yellow(`[${new Date().toLocaleString()}] Skipping update: Connection not configured. Please use the Web UI to set up your connection.`));
                    return;
                }

                console.log(chalk.blue(`[${new Date().toLocaleString()}] Updating prices...`));

                const updates = await manager.updateAllPrices();

                const successful = updates.filter(u => u.success).length;
                const failed = updates.filter(u => !u.success).length;

                if (successful > 0) {
                    console.log(chalk.green(`✓ Updated ${successful} stocks`));
                }
                if (failed > 0) {
                    console.log(chalk.red(`✗ Failed to update ${failed} stocks`));
                }
            } catch (error) {
                console.error(chalk.red('Error during update:'), error.message);
            }
        };

        // Run immediately on start
        await updatePrices();

        // Schedule periodic updates
        cron.schedule(`*/${updateInterval} * * * *`, updatePrices);

        console.log(chalk.green('✓ Daemon started'));

        // Keep process running
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\nShutting down...'));
            await manager.shutdown();
            process.exit(0);
        });
    });

// Parse arguments
program.parse();
