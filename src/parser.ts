import Papa from 'papaparse';
import fs from 'fs';
import { ColumnSchema, ParsedData } from './types';

// Parse CSV to detect schema only (samples first N rows)
export async function parseCSVSchema(filePath: string, sampleSize: number = 1000): Promise<{ columns: ColumnSchema[], totalRows: number }> {
  return new Promise((resolve, reject) => {
    const sampleRows: any[] = [];
    let headers: string[] = [];
    let totalRows = 0;

    const fileStream = fs.createReadStream(filePath, 'utf-8');

    Papa.parse(fileStream, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      step: (result) => {
        if (headers.length === 0 && result.meta.fields) {
          headers = result.meta.fields;
        }
        totalRows++;
        // Only keep sample rows for schema detection
        if (sampleRows.length < sampleSize) {
          sampleRows.push(result.data);
        }
      },
      complete: () => {
        const columns = inferSchema(headers, sampleRows);
        resolve({
          columns,
          totalRows,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

// Stream CSV data in batches without loading everything into memory
export function streamCSVBatches(
  filePath: string,
  batchSize: number,
  onBatch: (batch: any[], batchNumber: number) => Promise<void>,
  onComplete: () => void,
  onError: (error: any) => void
): void {
  let batch: any[] = [];
  let batchNumber = 0;
  let isPaused = false;

  const fileStream = fs.createReadStream(filePath, 'utf-8');

  const parser = Papa.parse(fileStream, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
    step: async (result, parserInstance) => {
      batch.push(result.data);

      if (batch.length >= batchSize && !isPaused) {
        isPaused = true;
        parserInstance.pause();
        
        const currentBatch = [...batch];
        batch = [];
        batchNumber++;

        try {
          await onBatch(currentBatch, batchNumber);
          isPaused = false;
          parserInstance.resume();
        } catch (error) {
          parserInstance.abort();
          onError(error);
        }
      }
    },
    complete: async () => {
      // Process remaining rows
      if (batch.length > 0) {
        batchNumber++;
        try {
          await onBatch(batch, batchNumber);
          onComplete();
        } catch (error) {
          onError(error);
        }
      } else {
        onComplete();
      }
    },
    error: (error) => {
      onError(error);
    },
  });
}

function inferSchema(headers: string[], rows: any[]): ColumnSchema[] {
  const sampleSize = Math.min(1000, rows.length);
  const sampleRows = rows.slice(0, sampleSize);

  return headers.map((header) => {
    const values = sampleRows.map((row) => row[header]).filter((val) => val !== null && val !== undefined && val !== '');

    if (values.length === 0) {
      return {
        name: header,
        type: 'string',
        nullable: true,
      };
    }

    const type = detectColumnType(values);
    const nullable = values.length < sampleRows.length;

    return {
      name: header,
      type,
      nullable,
    };
  });
}

function detectColumnType(values: any[]): ColumnSchema['type'] {
  let allNumbers = true;
  let allBooleans = true;
  let allDates = true;
  let allDateTimes = true;

  for (const value of values) {
    const strValue = String(value).trim();

    // Check if it's a number
    if (allNumbers && !isNumeric(strValue)) {
      allNumbers = false;
    }

    // Check if it's a boolean
    if (allBooleans && !isBoolean(strValue)) {
      allBooleans = false;
    }

    // Check if it's a date/datetime
    if (allDates || allDateTimes) {
      const dateCheck = isDate(strValue);
      if (!dateCheck.isDate) {
        allDates = false;
        allDateTimes = false;
      } else if (!dateCheck.hasTime) {
        allDateTimes = false;
      }
    }
  }

  if (allBooleans) return 'boolean';
  if (allNumbers) return 'number';
  if (allDateTimes) return 'datetime';
  if (allDates) return 'date';
  return 'string';
}

function isNumeric(value: string): boolean {
  if (value === '') return false;
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

function isBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  return ['true', 'false', '1', '0', 'yes', 'no'].includes(lower);
}

function isDate(value: string): { isDate: boolean; hasTime: boolean } {
  if (value === '') return { isDate: false, hasTime: false };

  // Common date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
  ];

  const dateTimePatterns = [
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/, // ISO 8601 with time
    /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/, // MM/DD/YYYY HH:MM
  ];

  // Check datetime first
  for (const pattern of dateTimePatterns) {
    if (pattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return { isDate: true, hasTime: true };
      }
    }
  }

  // Check date only
  for (const pattern of datePatterns) {
    if (pattern.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return { isDate: true, hasTime: false };
      }
    }
  }

  // Try parsing as a general date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    // Check if it has time components
    const hasTime = value.includes(':') || value.includes('T');
    return { isDate: true, hasTime };
  }

  return { isDate: false, hasTime: false };
}

export function convertValue(value: any, type: ColumnSchema['type']): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const strValue = String(value).trim();

  switch (type) {
    case 'number':
      return Number(strValue);
    case 'boolean':
      const lower = strValue.toLowerCase();
      return ['true', '1', 'yes'].includes(lower);
    case 'date':
    case 'datetime':
      return new Date(strValue);
    case 'string':
    default:
      return strValue;
  }
}