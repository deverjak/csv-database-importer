# CSV Database Importer

A powerful CLI tool for importing CSV files into multiple database systems with automatic schema detection, type inference, and streaming support for large files.

## Supported Databases

- **SQL Server (MSSQL)** - with proper handling of special characters in column names
- **PostgreSQL**
- **ClickHouse**
- **MongoDB**

## Features

- ✨ **Automatic type detection** (string, number, boolean, date, datetime)
- 📊 **Dynamic column detection** from CSV headers
- 🚀 **Streaming architecture** - handles files of any size without memory issues
- 💾 **Memory efficient** - constant ~50MB memory usage regardless of file size
- 🎯 **Progress tracking** with visual feedback and ETA
- 🔍 **Dry-run mode** to preview schema without importing
- 🔄 **Drop table option** for fresh imports
- 🌐 **Connection string support** via CLI or environment variables
- 🔧 **Special character handling** - properly escapes brackets and special chars in column names
- 📦 **Docker Compose** included for quick database setup

## Quick Start

### 1. Clone and Install

```bash
git clone <repository>
cd csv-importer
npm install
```

### 2. Start Databases with Docker

```bash
# Start all databases
docker-compose up -d

# Or use the automated setup script
./setup-docker.sh

# Or use Make commands
make setup
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.docker .env

# Or configure manually (see Environment Variables section)
```

### 4. Import Your Data

```bash
# Development mode
npm run dev -- import -f yourfile.csv -d mongodb -t your_table

# For large files (with increased memory)
npm run dev:large -- import -f largefile.csv -d postgres -t data -b 10000

# Production mode
npm run build
npm start import -f yourfile.csv -d mongodb -t your_table
```

## Installation

```bash
npm install
npm run build
```

Or for development:

```bash
npm install
npm run dev -- import [options]
```

## Usage

### Basic Usage

```bash
# Using connection string from .env
csv-import import -f data.csv -d postgres -t my_table

# Using connection string directly
csv-import import -f data.csv -d mssql -t my_table -c "Server=localhost;Database=mydb;..."

# Dry run to preview schema
csv-import import -f data.csv -d postgres -t my_table --dry-run

# Drop existing table before import
csv-import import -f data.csv -d mongodb -t my_collection --drop

# Custom batch size
csv-import import -f data.csv -d clickhouse -t my_table -b 5000

# For large files (increases memory limit)
npm run dev:large -- import -f large-data.csv -d mongodb -t big_data -b 10000
```

### Options

```
-f, --file <path>            Path to CSV file (required)
-d, --database <type>        Database type: mssql, postgres, clickhouse, mongodb (required)
-t, --table <name>           Table/Collection name (required)
-c, --connection <string>    Connection string (overrides .env)
-b, --batch-size <number>    Batch size for inserts (default: 1000)
--drop                       Drop table/collection if exists before import
--dry-run                    Parse CSV and show schema without importing
```

## Docker Compose Setup

The project includes a complete Docker Compose configuration for all databases.

### Start All Databases

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Using Make Commands

```bash
# See all available commands
make help

# Setup and start everything
make setup

# Import test data to all databases
make test-all

# Import to specific database
make test-mongodb
make test-postgres
make test-clickhouse
make test-mssql

# Access database shells
make shell-mongodb
make shell-postgres
make shell-clickhouse
make shell-mssql

# SQL Server troubleshooting
make diagnose-mssql
make fix-mssql
```

### Web Interfaces

After starting Docker Compose, you can access:

- **Adminer** (SQL databases): http://localhost:8080
- **Mongo Express** (MongoDB): http://localhost:8081

## Environment Variables

Create a `.env` file in the project root:

```bash
# SQL Server
MSSQL_CONNECTION_STRING=Server=localhost,1433;Database=testdb;User Id=sa;Password=YourStrong@Passw0rd;Encrypt=true;TrustServerCertificate=true

# PostgreSQL
POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/testdb

# ClickHouse
CLICKHOUSE_CONNECTION_STRING=http://default:@localhost:8123/default

# MongoDB
MONGODB_CONNECTION_STRING=mongodb://admin:password@localhost:27017/testdb?authSource=admin
```

## Large Files Support

The importer uses streaming to handle files of any size efficiently:

```bash
# For large files, use the dev:large script (4GB memory limit)
npm run dev:large -- import -f huge.csv -d postgres -t data -b 10000

# Or set memory manually
NODE_OPTIONS="--max-old-space-size=8192" npm run dev -- import -f huge.csv -d mongodb -t data -b 10000
```

**Memory Usage:** The importer only loads ~1000 rows for schema detection, then streams the rest. Memory usage stays constant regardless of file size.

| File Size | Rows  | Memory Usage | Processing Time\* |
| --------- | ----- | ------------ | ----------------- |
| 10 MB     | ~50K  | ~50 MB       | ~10 seconds       |
| 100 MB    | ~500K | ~50 MB       | ~1-2 minutes      |
| 1 GB      | ~5M   | ~50 MB       | ~10-15 minutes    |
| 10 GB     | ~50M  | ~50 MB       | ~2-3 hours        |

\*Times are approximate and vary by database and hardware

## Special Characters in Column Names

The tool properly handles special characters, including square brackets, in column names (especially important for SQL Server).

### Example

CSV with special characters:

```csv
Time[h],I[A],U[V],P[W],Temp[°C],Δ_Value
1.5,2.3,12.0,27.6,25.5,0.12
```

These are automatically escaped correctly:

- SQL Server: `[Time[h]]]`, `[I[A]]]`, `[Temp[°C]]]`
- PostgreSQL: `"Time[h]"`, `"I[A]"`, `"Temp[°C]"`
- Other databases handle them natively

## Type Detection

The tool automatically detects column types from CSV data:

| Detected Type | SQL Server    | PostgreSQL       | ClickHouse | MongoDB |
| ------------- | ------------- | ---------------- | ---------- | ------- |
| string        | NVARCHAR(MAX) | TEXT             | String     | String  |
| number        | FLOAT         | DOUBLE PRECISION | Float64    | Number  |
| boolean       | BIT           | BOOLEAN          | UInt8      | Boolean |
| date          | DATE          | DATE             | Date       | Date    |
| datetime      | DATETIME2     | TIMESTAMP        | DateTime   | Date    |

## Examples

### Example CSV

```csv
id,name,age,is_active,created_at
1,John Doe,30,true,2024-01-15 10:30:00
2,Jane Smith,25,false,2024-01-16 14:20:00
```

### Import to SQL Server

```bash
npm run dev -- import -f users.csv -d mssql -t users
```

### Import to PostgreSQL with drop

```bash
npm run dev -- import -f users.csv -d postgres -t users --drop
```

### Import to ClickHouse with custom batch size

```bash
npm run dev -- import -f users.csv -d clickhouse -t users -b 10000
```

### Import to MongoDB

```bash
npm run dev -- import -f users.csv -d mongodb -t users
```

## Performance Tips

### Batch Size Tuning

1. **Batch Size**: Adjust based on your data and database

   - Small datasets: 1000 (default)
   - Large datasets: 5000-10000
   - Very large datasets: 10000+

2. **Network**: For cloud databases, larger batch sizes reduce round trips

3. **Memory**: Smaller batch sizes use less memory

4. **Database-specific recommendations**:
   - **SQL Server**: 1,000-5,000 rows per batch
   - **PostgreSQL**: 1,000-5,000 rows per batch
   - **ClickHouse**: 10,000-50,000 rows per batch (handles very large batches well)
   - **MongoDB**: 5,000-10,000 rows per batch

### Recommended Batch Sizes by File Size

| File Size     | Recommended Batch Size     |
| ------------- | -------------------------- |
| < 100 MB      | 1,000 (default)            |
| 100 MB - 1 GB | 5,000                      |
| 1 GB - 10 GB  | 10,000                     |
| > 10 GB       | 10,000-50,000 (ClickHouse) |

### Memory Issues

If you encounter out-of-memory errors:

```bash
# Use the large file script
npm run dev:large -- import -f file.csv -d mongodb -t data

# Or increase memory manually
NODE_OPTIONS="--max-old-space-size=8192" npm run dev -- import -f file.csv -d mongodb -t data
```

## Error Handling

The tool provides clear error messages for common issues:

- Missing connection string
- Invalid CSV format
- Database connection failures
- Schema creation errors
- Insert failures
- Memory limit exceeded

Use the dry-run mode first to validate your CSV structure:

```bash
npm run dev -- import -f data.csv -d postgres -t my_table --dry-run
```

## Complete Example Workflow

```bash
# 1. Clone and setup
git clone <repository>
cd csv-importer
npm install

# 2. Start databases with Docker
docker-compose up -d
# Wait 30 seconds for databases to start
sleep 30

# 3. Configure environment
cp .env.docker .env

# 4. Test with sample data
npm run dev -- import -f sample-data.csv -d mongodb -t employees

# 5. Import your actual data
npm run dev:large -- import -f yourdata.csv -d postgres -t your_table -b 5000

# 6. Verify import
make shell-postgres
# Then: SELECT COUNT(*) FROM your_table;
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- import -f test.csv -d postgres -t test

# Run with increased memory (for large files)
npm run dev:large -- import -f large.csv -d postgres -t test

# Build for production
npm run build

# Run built version
npm start import -f test.csv -d postgres -t test
```

## Project Structure

```
csv-importer/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── importer.ts       # Main import logic with streaming
│   ├── parser.ts         # CSV parsing & type detection
│   ├── types.ts          # TypeScript interfaces
│   └── adapters/
│       ├── index.ts      # Adapter factory
│       ├── mssql.ts      # SQL Server adapter
│       ├── postgres.ts   # PostgreSQL adapter
│       ├── clickhouse.ts # ClickHouse adapter
│       └── mongodb.ts    # MongoDB adapter
├── docker-compose.yml    # All databases setup
├── Makefile             # Convenient commands
├── *.sh                 # Helper scripts
└── *.md                 # Documentation
```

## Key Features Explained

### Streaming Architecture

Unlike traditional CSV importers that load entire files into memory, this tool:

- Reads CSV files as streams
- Processes data in configurable batches
- Maintains constant memory usage (~50MB)
- Can handle files of any size (limited only by disk space)

### Automatic Type Detection

The tool analyzes the first 1,000 rows to detect:

- **Numbers**: Integer or float values
- **Booleans**: true/false, yes/no, 1/0
- **Dates**: YYYY-MM-DD format
- **DateTimes**: ISO 8601 and common formats
- **Strings**: Everything else

### Database-Specific Optimizations

- **SQL Server**: Multi-row parameterized INSERT with proper bracket escaping
- **PostgreSQL**: Batch INSERT with proper identifier quoting
- **ClickHouse**: Native batch insert (handles very large batches)
- **MongoDB**: Unordered insertMany for maximum throughput

## License

MIT
