import { createClient, ClickHouseClient } from '@clickhouse/client';
import { DatabaseAdapter, ColumnSchema } from '../types';
import { convertValue } from '../parser';

export class ClickHouseAdapter implements DatabaseAdapter {
  private client: ClickHouseClient | null = null;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    // Parse connection string (format: http://user:password@host:port/database)
    const url = new URL(this.connectionString);
    
    this.client = createClient({
      host: `${url.protocol}//${url.hostname}:${url.port || '8123'}`,
      username: url.username || 'default',
      password: url.password || '',
      database: url.pathname.slice(1) || 'default',
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.client!.ping();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async createTable(tableName: string, columns: ColumnSchema[], dropIfExists: boolean): Promise<void> {
    if (!this.client) throw new Error('Not connected to database');

    if (dropIfExists) {
      await this.client.command({
        query: `DROP TABLE IF EXISTS ${tableName}`,
      });
    }

    const columnDefinitions = columns.map((col) => {
      const chType = this.mapToClickHouseType(col.type, col.nullable);
      return `\`${col.name}\` ${chType}`;
    });

    const createTableSQL = `
      CREATE TABLE ${tableName} (
        ${columnDefinitions.join(',\n        ')}
      ) ENGINE = MergeTree()
      ORDER BY tuple()
    `;

    await this.client.command({ query: createTableSQL });
  }

  async insertBatch(tableName: string, columns: ColumnSchema[], rows: any[]): Promise<void> {
    if (!this.client) throw new Error('Not connected to database');

    const values = rows.map((row) => {
      return columns.map((col) => {
        const value = convertValue(row[col.name], col.type);
        if (value === null) return null;

        switch (col.type) {
          case 'string':
            return value;
          case 'number':
            return value;
          case 'boolean':
            return value ? 1 : 0;
          case 'date':
          case 'datetime':
            return value instanceof Date ? value.toISOString().split('T')[0] : value;
          default:
            return value;
        }
      });
    });

    await this.client.insert({
      table: tableName,
      values,
      format: 'JSONEachRow',
    });
  }

  private mapToClickHouseType(type: ColumnSchema['type'], nullable: boolean): string {
    let baseType: string;

    switch (type) {
      case 'string':
        baseType = 'String';
        break;
      case 'number':
        baseType = 'Float64';
        break;
      case 'boolean':
        baseType = 'UInt8';
        break;
      case 'date':
        baseType = 'Date';
        break;
      case 'datetime':
        baseType = 'DateTime';
        break;
      default:
        baseType = 'String';
    }

    return nullable ? `Nullable(${baseType})` : baseType;
  }
}