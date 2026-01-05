import { DatabaseAdapter, DatabaseType } from '../types';
import { MSSQLAdapter } from './mssql';
import { PostgresAdapter } from './postgres';
import { ClickHouseAdapter } from './clickhouse';
import { MongoDBAdapter } from './mongodb';

export function createAdapter(type: DatabaseType, connectionString: string): DatabaseAdapter {
  switch (type.toLowerCase()) {
    case 'mssql':
      return new MSSQLAdapter(connectionString);
    case 'postgres':
      return new PostgresAdapter(connectionString);
    case 'clickhouse':
      return new ClickHouseAdapter(connectionString);
    case 'mongodb':
      return new MongoDBAdapter(connectionString);
    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}