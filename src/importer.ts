import { ImportOptions } from './types';
import { parseCSVSchema, streamCSVBatches } from './parser';
import { createAdapter } from './adapters';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';

export async function importCsv(options: ImportOptions): Promise<void> {
  const { filePath, database, tableName, connectionString, batchSize, dropIfExists, dryRun } = options;

  // Step 1: Parse CSV schema only (samples first 1000 rows)
  let spinner = ora('Analyzing CSV file schema...').start();
  const { columns, totalRows } = await parseCSVSchema(filePath);
  spinner.succeed(`Found ${totalRows.toLocaleString()} rows with ${columns.length} columns`);

  // Display schema
  console.log(chalk.cyan('\n📋 Detected Schema:\n'));
  columns.forEach((col) => {
    const nullable = col.nullable ? chalk.gray('(nullable)') : chalk.yellow('(not null)');
    console.log(`  ${chalk.white(col.name)}: ${chalk.green(col.type)} ${nullable}`);
  });

  if (dryRun) {
    console.log(chalk.yellow('\n🏃 Dry run mode - skipping database operations\n'));
    return;
  }

  // Step 2: Connect to database
  spinner = ora('Connecting to database...').start();
  const adapter = createAdapter(database as any, connectionString);
  
  try {
    await adapter.connect();
    spinner.succeed('Connected to database');

    // Step 3: Create table
    spinner = ora(`Creating table '${tableName}'...`).start();
    await adapter.createTable(tableName, columns, dropIfExists);
    spinner.succeed(`Table '${tableName}' created`);

    // Step 4: Insert data in batches using streaming
    const totalBatches = Math.ceil(totalRows / batchSize);

    console.log(chalk.cyan(`\n📥 Importing ${totalRows.toLocaleString()} rows in batches of ${batchSize}...\n`));

    const progressBar = new cliProgress.SingleBar({
      format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} rows | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(totalRows, 0);

    let processedRows = 0;

    await new Promise<void>((resolve, reject) => {
      streamCSVBatches(
        filePath,
        batchSize,
        async (batch, batchNumber) => {
          try {
            await adapter.insertBatch(tableName, columns, batch);
            processedRows += batch.length;
            progressBar.update(processedRows);
          } catch (error) {
            reject(error);
          }
        },
        () => {
          progressBar.stop();
          resolve();
        },
        (error) => {
          progressBar.stop();
          reject(error);
        }
      );
    });

    console.log(chalk.green(`\n✨ Successfully imported ${processedRows.toLocaleString()} rows\n`));
  } catch (error) {
    spinner.fail('Import failed');
    throw error;
  } finally {
    await adapter.disconnect();
  }
}