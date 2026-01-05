#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import path from 'path';
import { importCsv } from './importer';

// Load environment variables
config();

const program = new Command();

program
  .name('csv-import')
  .description('Import CSV files to various databases')
  .version('1.0.0');

program
  .command('import')
  .description('Import a CSV file to a database')
  .requiredOption('-f, --file <path>', 'Path to CSV file')
  .requiredOption('-d, --database <type>', 'Database type (mssql, postgres, clickhouse, mongodb)')
  .requiredOption('-t, --table <name>', 'Table/Collection name')
  .option('-c, --connection <string>', 'Connection string (overrides .env)')
  .option('-b, --batch-size <number>', 'Batch size for inserts', '1000')
  .option('--drop', 'Drop table/collection if exists before import')
  .option('--dry-run', 'Parse CSV and show schema without importing')
  .action(async (options) => {
    try {
      const connectionString = options.connection || getConnectionStringFromEnv(options.database);
      
      if (!connectionString && !options.dryRun) {
        console.error(chalk.red('❌ No connection string provided. Use -c flag or set environment variable.'));
        console.log(chalk.yellow('\nExpected environment variables:'));
        console.log('  MSSQL_CONNECTION_STRING');
        console.log('  POSTGRES_CONNECTION_STRING');
        console.log('  CLICKHOUSE_CONNECTION_STRING');
        console.log('  MONGODB_CONNECTION_STRING');
        process.exit(1);
      }

      const filePath = path.resolve(options.file);
      
      console.log(chalk.cyan('\n📊 CSV Importer\n'));
      console.log(chalk.gray(`File: ${filePath}`));
      console.log(chalk.gray(`Database: ${options.database}`));
      console.log(chalk.gray(`Table: ${options.table}`));
      console.log(chalk.gray(`Batch Size: ${options.batchSize}\n`));

      await importCsv({
        filePath,
        database: options.database,
        tableName: options.table,
        connectionString,
        batchSize: parseInt(options.batchSize),
        dropIfExists: options.drop || false,
        dryRun: options.dryRun || false,
      });

      console.log(chalk.green('\n✅ Import completed successfully!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Import failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

function getConnectionStringFromEnv(database: string): string | undefined {
  const envMap: Record<string, string> = {
    mssql: 'MSSQL_CONNECTION_STRING',
    postgres: 'POSTGRES_CONNECTION_STRING',
    clickhouse: 'CLICKHOUSE_CONNECTION_STRING',
    mongodb: 'MONGODB_CONNECTION_STRING',
  };

  const envKey = envMap[database.toLowerCase()];
  return envKey ? process.env[envKey] : undefined;
}

program.parse();