# OptiMow v3 - Clean Rebuild Guide

## 🎯 **Core Principles (Learned from Mistakes)**

### **Single Source of Truth**
- ✅ All data flows through Supabase database
- ✅ Server-side only data collection (no client-side timers)
- ✅ One service per responsibility
- ❌ Never mix client-side and server-side data collection

### **Server-First Architecture** 
- ✅ Supabase Edge Functions handle all API calls
- ✅ Supabase Cron handles all scheduled tasks
- ✅ Frontend only reads from database
- ❌ Never make Husqvarna API calls from frontend

### **Iterative Development**
- ✅ Each iteration must be fully functional
- ✅ Test thoroughly before moving to next iteration
- ✅ Keep git commits small and reversible
- ❌ Never build multiple features simultaneously

---

## 📋 **Rebuild Plan**

### **Phase 1: Foundation (Auth + Database)**
**Goal**: Secure authentication with clean database schema

#### **Iteration 1.1: Authentication System**
```bash
# 1. Create new Vite + React + TypeScript project
npm create vite@latest optimow-v4 -- --template react-ts
cd optimow-v4
npm install

# 2. Install core dependencies
npm install @supabase/supabase-js
npm install @tanstack/react-query  # For data fetching
npm install zustand  # For state management
npm install react-router-dom
npm install tailwindcss
```

**Database Schema (Phase 1):**
```sql
-- Core tables only
CREATE TABLE auth_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mower_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES auth_sessions(session_id) ON DELETE CASCADE,
  husqvarna_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Core Files:**
```typescript
// src/lib/supabase.ts - Single Supabase client
// src/services/auth.ts - Auth service only
// src/stores/authStore.ts - Auth state only
// src/pages/LoginPage.tsx - Login flow
// src/pages/CallbackPage.tsx - OAuth callback
// src/components/ProtectedRoute.tsx - Route protection
```

**Success Criteria:**
- ✅ User can login with Husqvarna OAuth
- ✅ Tokens stored securely in database
- ✅ Auto token refresh works
- ✅ Protected routes work
- ✅ No TypeScript errors

#### **Iteration 1.2: Mower Discovery**
**Goal**: Fetch and store mower profiles

**New Edge Function:**
```typescript
// supabase/functions/mower-discovery/index.ts
// - Fetches mowers from Husqvarna API
// - Stores in mower_profiles table
// - Returns mower list to frontend
```

**Success Criteria:**
- ✅ Mowers fetched and stored on first login
- ✅ Mower selection persists
- ✅ Clean mower profile display

---

### **Phase 2: Server-Side Data Collection**
**Goal**: Automated data collection with single source of truth

#### **Iteration 2.1: Data Collection Schema**
```sql
-- Data storage tables
CREATE TABLE data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mower_id TEXT NOT NULL REFERENCES mower_profiles(husqvarna_id),
  
  -- Mower state
  activity TEXT NOT NULL,
  mode TEXT NOT NULL,
  battery_level INTEGER NOT NULL,
  error_code INTEGER,
  
  -- Position (if available)
  latitude DECIMAL,
  longitude DECIMAL,
  
  -- Metadata
  collected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_mower_collected_at (mower_id, collected_at DESC)
);

CREATE TABLE work_area_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mower_id TEXT NOT NULL,
  area_id INTEGER NOT NULL,
  progress_percent INTEGER NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_mower_area_collected_at (mower_id, area_id, collected_at DESC)
);
```

#### **Iteration 2.2: Data Collection Edge Function**
```typescript
// supabase/functions/data-collector/index.ts
export default async function(req: Request) {
  // 1. Get active sessions (valid tokens)
  // 2. For each session, fetch mower data
  // 3. Store in data_snapshots table
  // 4. Store work area progress
  // 5. Return collection summary
}
```

**Success Criteria:**
- ✅ Edge function works when called manually
- ✅ Data appears in database tables
- ✅ Proper error handling and logging

#### **Iteration 2.3: Automated Collection (Cron)**
```sql
-- Simple, robust cron setup
SELECT cron.schedule(
  'data-collection',
  '*/5 * * * *',
  'SELECT extensions.http_post(
    ''https://[project].supabase.co/functions/v1/data-collector'',
    '''',
    ''application/json''
  );'
);
```

**Success Criteria:**
- ✅ Data collected every 5 minutes automatically
- ✅ Works without any browser open
- ✅ Robust error handling

---

### **Phase 3: Frontend Data Display**
**Goal**: Clean, real-time data display

#### **Iteration 3.1: Live View**
```typescript
// src/services/dataService.ts - Single data service
class DataService {
  // Only reads from database
  async getLatestSnapshot(mowerId: string) { }
  async getRecentSnapshots(mowerId: string, hours: number) { }
  async getWorkAreaProgress(mowerId: string) { }
}

// src/pages/LiveView.tsx - Clean live data display
// Uses React Query for data fetching
// Polls database every 30 seconds
// No complex state management
```

**Success Criteria:**
- ✅ Shows current mower status
- ✅ Updates automatically
- ✅ Clean, simple UI
- ✅ No API calls from frontend

#### **Iteration 3.2: Historical Data**
```typescript
// src/pages/HistoryView.tsx
// Simple charts showing:
// - Battery levels over time
// - Activity patterns
// - Work area progress
```

---

### **Phase 4: Enhanced Analytics** (Optional)
**Goal**: Simple analytics based on collected data

#### **Iteration 4.1: Basic Analytics**
```sql
-- Simple analytics views
CREATE VIEW daily_mowing_summary AS
SELECT 
  mower_id,
  DATE(collected_at) as mowing_date,
  COUNT(*) as data_points,
  AVG(battery_level) as avg_battery,
  SUM(CASE WHEN activity = 'MOWING' THEN 1 ELSE 0 END) as mowing_intervals
FROM epos_data_snapshots
WHERE collected_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY mower_id, DATE(collected_at);
```

**Simple Analytics Service:**
```typescript
// src/services/analytics.ts
// Basic statistics from EPOS data
// No complex session detection needed
```

---

### **Phase 5: Area Progress Tracking**
**Goal**: Track work area completion using lastTimeCompleted

#### **Iteration 5.1: Area Completion Detection**
```typescript
// Use the existing lastTimeCompleted field from work areas
const detectAreaCompletion = (currentAreas, previousAreas) => {
  return currentAreas.filter((area, index) => {
    const prevArea = previousAreas[index];
    return prevArea && 
           area.lastTimeCompleted !== prevArea.lastTimeCompleted &&
           area.progress === 0;
  });
};
```

---

## 🛠️ **Implementation Guidelines**

### **File Structure**
```
src/
├── lib/
│   ├── supabase.ts          # Single Supabase client
│   └── types.ts             # Shared TypeScript types
├── services/
│   ├── auth.ts              # Auth service only
│   └── data.ts              # Data service only
├── stores/
│   ├── authStore.ts         # Auth state only
│   └── dataStore.ts         # Data state only
├── pages/
│   ├── LoginPage.tsx
│   ├── LiveView.tsx
│   └── HistoryView.tsx
└── components/
    ├── ui/                  # Reusable UI components
    ├── charts/              # Chart components
    └── layout/              # Layout components

supabase/
├── functions/
│   ├── mower-discovery/
│   ├── auto-resume-monitor/
│   ├── husqvarna-oauth-exchange/
│   └── husqvarna-token-refresh/
└── migrations/
    ├── 001_auth.sql
    ├── 002_data_collection.sql
    └── 003_auto_resume.sql
```

### **Technology Stack**
- **Frontend**: Vite + React + TypeScript + TailwindCSS
- **State**: Zustand (simple) + React Query (data fetching)
- **Backend**: Supabase Edge Functions + Cron
- **Database**: PostgreSQL (Supabase)
- **Charts**: Recharts or similar lightweight library

### **Development Rules**
1. **One feature per iteration**
2. **Test each iteration thoroughly**
3. **No TypeScript errors allowed**
4. **No client-side API calls to Husqvarna**
5. **All data flows through database**
6. **Keep services simple and focused**
7. **Use React Query for all data fetching**
8. **Handle errors gracefully everywhere**

### **Testing Checklist Per Iteration**
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] All features work as expected
- [ ] Database queries are efficient
- [ ] Error handling works
- [ ] Mobile responsive
- [ ] Performance is acceptable

---

## 🚀 **Getting Started**

1. **Create new repository**
2. **Start with Iteration 1.1 (Auth)**
3. **Don't move to next iteration until current one is perfect**
4. **Keep iterations small (1-2 days max)**
5. **Test thoroughly at each step**

This approach will result in a clean, maintainable, scalable application with a clear architecture and single source of truth.