# OptiMow v3 - Supabase Setup Guide

This directory contains the database schema and configuration for OptiMow v3.

## Project Structure

```
supabase/
├── migrations/
│   └── 20250725000001_initial_schema.sql  # Initial database schema
├── config.toml                            # Supabase local development config
└── README.md                             # This file
```

## Quick Start

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Initialize Supabase Project

If you haven't already created a Supabase project:

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key from Settings > API

### 3. Set Up Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Fill in your Supabase credentials in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Migrations

To apply the database schema to your Supabase project:

```bash
# Link to your remote Supabase project
supabase link --project-ref your-project-ref

# Push migrations to remote database
supabase db push
```

### 5. Local Development (Optional)

For local development with Supabase:

```bash
# Start local Supabase stack
supabase start

# Apply migrations locally
supabase db reset
```

## Database Schema

### Tables

#### `auth_sessions`
Stores secure authentication tokens for Husqvarna API access.

| Column         | Type         | Description                    |
|----------------|--------------|--------------------------------|
| session_id     | UUID         | Primary key, unique session ID |
| user_email     | TEXT         | User email address             |
| access_token   | TEXT         | Husqvarna API access token     |
| refresh_token  | TEXT         | Husqvarna API refresh token    |
| expires_at     | TIMESTAMPTZ  | Token expiration timestamp     |
| created_at     | TIMESTAMPTZ  | Record creation time           |
| updated_at     | TIMESTAMPTZ  | Last update time               |

#### `mower_profiles`
Stores mower information linked to authenticated sessions.

| Column         | Type         | Description                      |
|----------------|--------------|----------------------------------|
| id             | UUID         | Primary key                      |
| session_id     | UUID         | Foreign key to auth_sessions     |
| husqvarna_id   | TEXT         | Unique Husqvarna mower ID        |
| name           | TEXT         | User-friendly mower name         |
| model          | TEXT         | Mower model (optional)           |
| created_at     | TIMESTAMPTZ  | Record creation time             |

### Indexes

- `idx_auth_sessions_user_email`: Fast lookup by user email
- `idx_auth_sessions_expires_at`: Efficient cleanup of expired sessions
- `idx_mower_profiles_session_id`: Fast lookup by session
- `idx_mower_profiles_husqvarna_id`: Unique constraint and fast lookup

## Security Considerations

### Row Level Security (RLS)

Currently, RLS is not enabled as we're handling authentication through the Husqvarna API rather than Supabase Auth. This means:

- Application-level security is required
- All database queries should include proper filtering
- Consider enabling RLS in future phases if needed

### Token Storage

- Access tokens are stored encrypted in the database
- Refresh tokens are used to maintain session validity
- Expired sessions are automatically cleaned up

## TypeScript Integration

The project includes full TypeScript support:

- `/src/lib/database.types.ts`: Generated types for all tables
- `/src/lib/supabase.ts`: Configured Supabase client
- `/src/lib/database.service.ts`: Service layer with helpful methods

## Usage Examples

### Creating a Session

```typescript
import { AuthSessionsService } from '@/lib/database.service';

const session = await AuthSessionsService.createSession({
  user_email: 'user@example.com',
  access_token: 'husqvarna_access_token',
  refresh_token: 'husqvarna_refresh_token',
  expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
});
```

### Adding a Mower Profile

```typescript
import { MowerProfilesService } from '@/lib/database.service';

const mower = await MowerProfilesService.createMowerProfile({
  session_id: session.session_id,
  husqvarna_id: 'mower-123',
  name: 'My Automower',
  model: 'Automower 430X',
});
```

## Migration Management

### Creating New Migrations

```bash
# Create a new migration file
supabase migration new migration_name

# Apply migration locally
supabase db reset

# Push to remote
supabase db push
```

### Best Practices

1. **Always test migrations locally first**
2. **Use descriptive migration names with timestamps**
3. **Include rollback scripts when possible**
4. **Add proper indexes for performance**
5. **Document schema changes**

## Monitoring and Maintenance

### Cleanup Tasks

The database includes automatic cleanup mechanisms:

- Expired sessions are automatically removed
- Orphaned mower profiles are cascade deleted when sessions are removed

### Performance Monitoring

Monitor these key metrics:

- Query performance on indexed columns
- Session cleanup frequency
- Database connection pool usage

## Troubleshooting

### Common Issues

1. **Environment variables not loaded**: Ensure `.env` file is properly configured
2. **Migration failures**: Check for conflicting data or schema issues
3. **Connection issues**: Verify Supabase project status and credentials

### Useful Commands

```bash
# Check migration status
supabase migration list

# Reset local database
supabase db reset

# Generate TypeScript types
supabase gen types typescript --project-id your-project-ref > src/lib/database.types.ts
```