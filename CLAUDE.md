# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. You should always try to have a clean code base, delete files that are not in use that you have created. 

# OptiMow v3 - Claude Context

## Project Overview
OptiMow v3 is a Husqvarna mower monitoring application being rebuilt with clean architecture principles.

**Current Status**: Phase 1 Complete (Auth + Discovery). Ready for Phase 2: EPOS Data Collection.

## Development Commands

**Project Initialization** (✅ COMPLETED):
```bash
# Project already initialized with Vite + React + TypeScript
# Dependencies already installed and configured
# TailwindCSS v4 configured with Vite plugin
```

**Expected Development Commands** (Once initialized):
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run type-check   # TypeScript validation (custom script needed)
npm run lint         # ESLint (when configured)
```

## Current Architecture Status

**✅ COMPLETED (Phase 1)**:
- Authentication system with Husqvarna OAuth
- Mower discovery and profile management
- Auto-resume monitoring functionality
- Basic dashboard with mower status display

**🚀 ONGOING (Phase 2 - EPOS Data Collection)**:
- EPOS-specific data collection system
- Session detection and area completion tracking
- Performance measurement (clock time, effective time, efficiency)

## Core Architecture Principles
- **Server-First**: All Husqvarna API calls via Supabase Edge Functions only
- **Single Source of Truth**: All data flows through Supabase database
- **No Client-Side API Calls**: Frontend only reads from database
- **Server-Side Data Collection**: Supabase Cron handles scheduled tasks

## Technology Stack
- **Frontend**: Vite + React + TypeScript + TailwindCSS v4
- **State Management**: Zustand + React Query
- **Backend**: Supabase Edge Functions + Cron
- **Database**: PostgreSQL (Supabase)
- **Target Mowers**: EPOS mowers only (systematic mowing with progress data)

**Important**: This project uses TailwindCSS v4 with Vite plugin configuration. See `docs/tailwind-v4-setup.md` for complete setup guide.

## Key Development Rules
1. No TypeScript errors allowed
2. No client-side Husqvarna API calls
3. All data must flow through database
4. One feature per iteration
5. Test thoroughly before moving to next iteration
6. Keep services simple and focused
7. Use React Query for all data fetching

## Project Structure
```
src/
├── lib/supabase.ts          # Single Supabase client
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
│   ├── data-collector/
│   └── session-analyzer/
└── migrations/
```

## Database Schema

**✅ Phase 1 Tables (Implemented)**:
- `auth_sessions` - Secure token storage
- `mower_profiles` - Mower information
- `auto_resume_tracking` - Auto-resume functionality
- `auto_resume_attempts` - Auto-resume history

**🚀 Phase 2 Tables (Next Implementation)**:
- `epos_data_snapshots` - EPOS mower data with work area progress
- `epos_mowing_sessions` - Detected mowing sessions with timing
- `epos_area_completions` - Complete area cycles with performance metrics
- `epos_session_events` - Detailed session event tracking
- `data_collection_gaps` - Gap detection and backfill management

## EPOS Performance Measurement Implementation Plan

**🎯 GOAL**: Measure area completion time with 3 metrics:
1. **Total Clock Time** - Complete time commitment (including charging, errors)
2. **Effective Mowing Time** - Pure cutting work only
3. **Cutting Efficiency** - Progress % per mowing minute

### **📋 Phase 2: EPOS Data Collection System (17-19 days)**

**Pre-Implementation Setup (2 days)**:
- Create EPOS-specific test database schema
- Build synthetic EPOS data generators
- Set up automated validation scripts

**Phase 2.1: Enhanced Data Collection (4 days)**:
- Create `epos_data_snapshots` table with progress tracking
- Build `epos-data-collector` Edge Function (every 5 minutes)
- Add API failure handling with exponential backoff
- Test: 99.9% uptime, <5min gaps, multi-area tracking

**Phase 2.2: Session Detection (5 days)**:
- Create `epos_mowing_sessions` table
- Build `epos-session-analyzer` Edge Function (every 15 minutes)
- Handle EPOS progress patterns (jumps, reversals, 0% periods)
- Test: <10% false positives, confidence scoring

**Phase 2.3: Area Completion Aggregation (4 days)**:
- Create `epos_area_completions` table
- Build `epos-completion-aggregator` Edge Function (hourly)
- Handle complex patterns (multi-day, weather interruptions)
- Test: ±1% accuracy for all 3 time metrics

**Phase 2.4: Frontend Dashboard (4 days)**:
- Real-time area status and progress display
- Historical performance trends and comparisons
- Test: <2s response times, mobile responsive

### **Iterative Development Approach**:
- Each phase must be fully functional before proceeding
- Comprehensive testing including API failures and edge cases
- No TypeScript errors allowed at any stage
- Test thoroughly with real EPOS mower data

## API Integration

**Husqvarna API Endpoints** (from swagger specs):
- **Auth API**: OAuth2 token management, documented in `auth_swagger.yml`
- **Connect API**: Mower control and status, documented in `connect_swagger.yml`

**Critical Rule**: Never make direct Husqvarna API calls from frontend - all API interactions must go through Supabase Edge Functions.

## Validation Commands
Before considering any iteration complete:
```bash
npm run build        # Check for build errors  
npm run type-check   # TypeScript validation
# Manual browser testing for runtime errors
# Database query testing via Supabase dashboard
```

## Important Notes
- Never mix client-side and server-side data collection
- Each iteration must be fully functional before moving forward
- Keep git commits small and reversible
- Handle errors gracefully everywhere
- Ensure mobile responsiveness

## Getting Started with Phase 2

**Current Phase**: Phase 2.1 - Enhanced Data Collection

**Next Actions**:
1. Start with Pre-Implementation Setup (testing infrastructure)
2. Implement Phase 2.1: EPOS data collection with progress tracking
3. Don't move to next phase until current one passes all tests
4. Focus on EPOS mowers only - full systematic mowing support

**Key Files for Phase 2**:
- `docs/session-detection-edge-cases.md` - Edge case handling
- `docs/performance-recommendations.md` - Optimization strategies
- `docs/real-world-testing-scenarios.md` - Comprehensive test cases
- `supabase/migrations/draft_session_tracking_schema.sql` - Database design