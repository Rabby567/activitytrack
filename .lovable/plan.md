

## Fix: Stats Not Calculating Correctly Due to 1,000 Row Query Limit

### Root Cause

The database contains **8,792 activity logs** for Toufiq this month, but the query in `useActivityLogs` only fetches **1,000 rows** (Supabase's default limit). The stats are then calculated on this incomplete subset, showing 8.3h instead of the actual 73.3h.

### Actual vs Displayed Data (Toufiq, This Month)

| Metric | Displayed | Actual |
|--------|-----------|--------|
| Total Hours | 8.3h | 73.3h |
| Productive Time | 2.4h | 30.8h |
| Idle Time | 6.0h | 42.5h |
| Productivity Score | 28% | 42% |

### Solution

Move the stats calculation to the database using a SQL aggregation query, and keep the detailed logs query (with a reasonable limit) only for chart rendering.

#### File: `src/hooks/useActivityLogs.tsx`

**Change 1: Add a separate stats query using RPC or direct SQL**

Create a database function that calculates totals server-side, so we don't need to fetch all rows to the client.

**Change 2: Create a database function (`get_activity_stats`)**

A new PostgreSQL function that accepts employee_id, start_date, and end_date parameters, and returns:
- `total_working_seconds`: sum of duration where app matches productive apps
- `total_idle_seconds`: sum of duration for all other apps
- `app_usage`: JSON object of app name to total seconds

The productive app detection will use the same logic (checking for photoshop, indesign, illustrator keywords and .psd, .psb, .indd, .ai extensions).

**Change 3: Keep existing logs query for charts but with pagination awareness**

The detailed logs query will remain for chart data, but increase the limit to fetch more rows (e.g., 10,000) or paginate. For the stats cards, use the new database function which processes all rows server-side.

### Implementation Steps

1. **Create database function** `get_activity_stats(p_employee_id uuid, p_start_date timestamptz, p_end_date timestamptz)` via migration that returns working seconds, idle seconds, and app usage aggregated across ALL matching rows.

2. **Update `useActivityLogs` hook** to:
   - Call the new database function for stats (totalWorkingTime, totalIdleTime, appUsage)
   - Keep the existing query for raw logs but add `.limit(5000)` for chart data
   - Return both the accurate stats and the log data

3. **No changes needed to Analytics.tsx or EmployeeDetail.tsx** -- they consume the hook's return values which will now be accurate.

### Technical Details

**Database function (SQL migration):**

```text
CREATE OR REPLACE FUNCTION get_activity_stats(
  p_employee_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS JSON AS $$
  -- Aggregates all matching rows server-side
  -- Classifies apps as productive using LIKE patterns
  -- Returns { working_seconds, idle_seconds, app_usage }
$$
```

**Hook changes:**
- Add a second query that calls `supabase.rpc('get_activity_stats', params)`
- Use returned working_seconds and idle_seconds for the stats cards
- Fall back to client-side calculation if the RPC fails

### Files to Create/Modify

| File | Changes |
|------|---------|
| Database migration | New `get_activity_stats` function |
| `src/hooks/useActivityLogs.tsx` | Add RPC call for stats, increase log limit |

