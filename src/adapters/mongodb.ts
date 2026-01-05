import { MongoClient, Db, Collection } from 'mongodb';
import { DatabaseAdapter, ColumnSchema } from '../types';
import { convertValue } from '../parser';

export class MongoDBAdapter implements DatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.connectionString);
    await this.client.connect();
    
    // Extract database name from connection string
    const url = new URL(this.connectionString);
    const dbName = url.pathname.slice(1) || 'test';
    this.db = this.client.db(dbName);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.client!.db().admin().ping();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async createTable(tableName: string, columns: ColumnSchema[], dropIfExists: boolean): Promise<void> {
    if (!this.db) throw new Error('Not connected to database');

    if (dropIfExists) {
      try {
        await this.db.collection(tableName).drop();
      } catch (error: any) {
        // Ignore error if collection doesn't exist
        if (error.code !== 26) {
          throw error;
        }
      }
    }

    // Create collection (will be created automatically on first insert if not exists)
    await this.db.createCollection(tableName);

    // Create indexes for better query performance
    // Index on date/datetime columns if they exist
    const dateColumns = columns.filter((c) => c.type === 'date' || c.type === 'datetime');
    for (const col of dateColumns) {
      await this.db.collection(tableName).createIndex({ [col.name]: 1 });
    }
  }

  async insertBatch(tableName: string, columns: ColumnSchema[], rows: any[]): Promise<void> {
    if (!this.db) throw new Error('Not connected to database');

    const collection = this.db.collection(tableName);

    const documents = rows.map((row) => {
      const doc: any = {};
      columns.forEach((col) => {
        const value = convertValue(row[col.name], col.type);
        doc[col.name] = value;
      });
      return doc;
    });

    // MongoDB can handle large batch inserts efficiently
    if (documents.length > 0) {
      await collection.insertMany(documents, { ordered: false });
    }
  }
}