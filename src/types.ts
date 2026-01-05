export type DatabaseType = 'mssql' | 'postgres' | 'clickhouse' | 'mongodb';

export interface ImportOptions {
  filePath: string;
  database: DatabaseType;
  tableName: string;
  connectionString: string;
  batchSize: number;
  dropIfExists: boolean;
  dryRun: boolean;
}

export interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  nullable: boolean;
}

export interface ParsedData {
  columns: ColumnSchema[];
  rows: any[];
  totalRows: number;
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createTable(tableName: string, columns: ColumnSchema[], dropIfExists: boolean): Promise<void>;
  insertBatch(tableName: string, columns: ColumnSchema[], rows: any[]): Promise<void>;
  testConnection(): Promise<boolean>;
}