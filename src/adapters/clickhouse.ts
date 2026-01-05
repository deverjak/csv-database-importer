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
    if (rows.length === 0) return;

    // Format data as array of objects for JSONEachRow format
    const values = rows.map((row) => {
      const record: any = {};
      columns.forEach((col) => {
        const value = convertValue(row[col.name], col.type);
        
        if (value === null) {
          record[col.name] = null;
          return;
        }

        switch (col.type) {
          case 'string':
            record[col.name] = value;
            break;
          case 'number':
            record[col.name] = value;
            break;
          case 'boolean':
            record[col.name] = value ? 1 : 0;
            break;
          case 'date':
            // ClickHouse Date format: YYYY-MM-DD
            record[col.name] = value instanceof Date 
              ? value.toISOString().split('T')[0] 
              : value;
            break;
          case 'datetime':
            // ClickHouse DateTime format: YYYY-MM-DD HH:MM:SS
            if (value instanceof Date) {
              const pad = (n: number) => n.toString().padStart(2, '0');
              const year = value.getFullYear();
              const month = pad(value.getMonth() + 1);
              const day = pad(value.getDate());
              const hour = pad(value.getHours());
              const minute = pad(value.getMinutes());
              const second = pad(value.getSeconds());
              record[col.name] = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
            } else {
              record[col.name] = value;
            }
            break;
          default:
            record[col.name] = value;
        }
      });
      return record;
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