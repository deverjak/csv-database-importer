import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter, ColumnSchema } from '../types';
import { convertValue } from '../parser';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.connectionString,
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      const client = await this.pool!.connect();
      client.release();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async createTable(tableName: string, columns: ColumnSchema[], dropIfExists: boolean): Promise<void> {
    if (!this.pool) throw new Error('Not connected to database');

    const client = await this.pool.connect();
    try {
      if (dropIfExists) {
        await client.query(`DROP TABLE IF EXISTS ${tableName}`);
      }

      const columnDefinitions = columns.map((col) => {
        const pgType = this.mapToPostgresType(col.type);
        const nullable = col.nullable ? '' : 'NOT NULL';
        return `"${col.name}" ${pgType} ${nullable}`;
      });

      const createTableSQL = `
        CREATE TABLE ${tableName} (
          ${columnDefinitions.join(',\n          ')}
        )
      `;

      await client.query(createTableSQL);
    } finally {
      client.release();
    }
  }

  async insertBatch(tableName: string, columns: ColumnSchema[], rows: any[]): Promise<void> {
    if (!this.pool) throw new Error('Not connected to database');

    const client = await this.pool.connect();
    try {
      // Use COPY for better performance with large datasets
      const columnNames = columns.map((c) => `"${c.name}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      // For smaller batches, use regular INSERT
      if (rows.length < 100) {
        for (const row of rows) {
          const values = columns.map((col) => convertValue(row[col.name], col.type));
          await client.query(
            `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
            values
          );
        }
      } else {
        // For larger batches, use multi-row INSERT
        const valueGroups: string[] = [];
        const allValues: any[] = [];
        let paramIndex = 1;

        for (const row of rows) {
          const rowPlaceholders = columns.map(() => `$${paramIndex++}`).join(', ');
          valueGroups.push(`(${rowPlaceholders})`);
          columns.forEach((col) => {
            allValues.push(convertValue(row[col.name], col.type));
          });
        }

        const insertSQL = `
          INSERT INTO ${tableName} (${columnNames})
          VALUES ${valueGroups.join(',\n          ')}
        `;

        await client.query(insertSQL, allValues);
      }
    } finally {
      client.release();
    }
  }

  private mapToPostgresType(type: ColumnSchema['type']): string {
    switch (type) {
      case 'string':
        return 'TEXT';
      case 'number':
        return 'DOUBLE PRECISION';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMP';
      default:
        return 'TEXT';
    }
  }
}