import sql from 'mssql';
import { DatabaseAdapter, ColumnSchema } from '../types';
import { convertValue } from '../parser';

export class MSSQLAdapter implements DatabaseAdapter {
  private pool: sql.ConnectionPool | null = null;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    this.pool = await sql.connect(this.connectionString);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async createTable(tableName: string, columns: ColumnSchema[], dropIfExists: boolean): Promise<void> {
    if (!this.pool) throw new Error('Not connected to database');

    if (dropIfExists) {
      await this.pool.request().query(`
        IF OBJECT_ID('${this.escapeSQLIdentifier(tableName)}', 'U') IS NOT NULL 
        DROP TABLE ${this.escapeSQLIdentifier(tableName)}
      `);
    }

    const columnDefinitions = columns.map((col) => {
      const sqlType = this.mapToSQLType(col.type);
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      const escapedName = this.escapeSQLIdentifier(col.name);
      return `${escapedName} ${sqlType} ${nullable}`;
    });

    const createTableSQL = `
      CREATE TABLE ${this.escapeSQLIdentifier(tableName)} (
        ${columnDefinitions.join(',\n        ')}
      )
    `;

    await this.pool.request().query(createTableSQL);
  }

  private escapeSQLIdentifier(name: string): string {
    // SQL Server uses square brackets to delimit identifiers
    // For names with brackets, we need to escape them properly
    // Replace ] with ]] to escape closing brackets inside the identifier
    const escaped = name.replace(/\]/g, ']]');
    return `[${escaped}]`;
  }

  async insertBatch(tableName: string, columns: ColumnSchema[], rows: any[]): Promise<void> {
    if (!this.pool) throw new Error('Not connected to database');
    if (rows.length === 0) return;

    // SQL Server has a limit of 2100 parameters per query
    // Calculate how many rows we can insert at once
    const maxParams = 2000;
    const paramsPerRow = columns.length;
    const maxRowsPerInsert = Math.floor(maxParams / paramsPerRow);
    
    // Split into smaller batches if needed
    for (let batchStart = 0; batchStart < rows.length; batchStart += maxRowsPerInsert) {
      const batchRows = rows.slice(batchStart, batchStart + maxRowsPerInsert);
      
      // Build the INSERT statement with proper column escaping
      const columnNames = columns.map(col => this.escapeSQLIdentifier(col.name)).join(', ');
      
      // Create placeholders for each row
      const valuePlaceholders: string[] = [];
      const request = this.pool.request();
      
      batchRows.forEach((row, rowIndex) => {
        const rowPlaceholders = columns.map((col, colIndex) => {
          const paramName = `p${rowIndex}_${colIndex}`;
          const value = convertValue(row[col.name], col.type);
          const sqlType = this.getSQLTypeForBulk(col.type);
          request.input(paramName, sqlType, value);
          return `@${paramName}`;
        });
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      });
      
      const insertSQL = `
        INSERT INTO ${this.escapeSQLIdentifier(tableName)} (${columnNames})
        VALUES ${valuePlaceholders.join(',\n        ')}
      `;
      
      await request.query(insertSQL);
    }
  }

  private mapToSQLType(type: ColumnSchema['type']): string {
    switch (type) {
      case 'string':
        return 'NVARCHAR(MAX)';
      case 'number':
        return 'FLOAT';
      case 'boolean':
        return 'BIT';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'DATETIME2';
      default:
        return 'NVARCHAR(MAX)';
    }
  }

  private getSQLTypeForBulk(type: ColumnSchema['type']): any {
    switch (type) {
      case 'string':
        return sql.NVarChar;
      case 'number':
        return sql.Float;
      case 'boolean':
        return sql.Bit;
      case 'date':
        return sql.Date;
      case 'datetime':
        return sql.DateTime2;
      default:
        return sql.NVarChar;
    }
  }
}