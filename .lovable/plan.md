

## Fix: Daily Activity Chart Missing Older Days Due to 5,000 Row Limit

### Problem

The stats cards show correct totals (73.8h) because they use the server-side `get_activity_stats` function. However, the Daily Activity Breakdown chart relies on the raw logs query which is capped at 5,000 rows (ordered newest first). February has ~8,853 logs, so the chart only shows the most recent ~5,000 -- missing Feb 01-05.

### Solution

Extend the existing `get_activity_stats` database function to also return a **daily breakdown** (working and idle seconds per day). This way the chart uses server-side aggregated data instead of raw logs, just like the stats cards.

### Implementation Steps

1. **Update the `get_activity_stats` database function** to include a `daily_breakdown` array in its return JSON, containing `{ date, working_seconds, idle_seconds }` for each day with data.

2. **Update `useActivityLogs` hook** to expose `dailyBreakdown` from the RPC response.

3. **Update `Analytics.tsx`** to use the server-side daily breakdown data instead of computing it from raw logs. The existing logic that pre-fills all days in the range will remain, but will be populated from the RPC data instead of from the limited logs array.

### Files to Create/Modify

| File | Changes |
|------|---------|
| Database migration | Update `get_activity_stats` to return `daily_breakdown` |
| `src/hooks/useActivityLogs.tsx` | Expose `dailyBreakdown` from stats |
| `src/pages/Analytics.tsx` | Use `dailyBreakdown` instead of `logs` for the daily chart |

### Technical Details

**Database function update:**

The function will add a `daily_breakdown` key to its JSON return:

```text
daily_breakdown: [
  { "date": "2026-02-01", "working_seconds": 3600, "idle_seconds": 7200 },
  { "date": "2026-02-02", "working_seconds": 5400, "idle_seconds": 4800 },
  ...
]
```

This aggregates ALL matching rows grouped by date, with no row limit.

**Analytics.tsx `dailyData` update:**

Instead of iterating over `logs` (which is capped), it will iterate over the `dailyBreakdown` array from the RPC, converting seconds to hours and mapping them into the pre-populated day map.

