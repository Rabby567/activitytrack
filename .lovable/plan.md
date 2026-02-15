

## Fix: Daily Activity Chart Missing Days and Date Range Issues

### Problems Identified

1. **Daily chart only shows days with data**: The chart builds its data from logs, so days without any logged activity don't appear at all. For "This Week", all 7 days (Sun-Sat) should always be shown, even if some have zero hours.

2. **Chart data limited to 5,000 rows**: While the stats cards now use the server-side RPC (accurate), the daily breakdown chart still relies on the raw logs query (capped at 5,000 rows). If there are more than 5,000 logs in a week/month, the chart will be incomplete.

### Solution

#### 1. Fix Daily Chart to Show All Days (`src/pages/Analytics.tsx`)

Update the `dailyData` calculation to:
- Pre-populate all days within the selected date range (e.g., Sun through Sat for "This Week")
- Ensure days appear in chronological order, not insertion order
- Show zero-value bars for days with no activity

For "Today", show just that one day. For "This Week", show all 7 days. For "This Month", show all dates grouped by day name or date.

#### 2. Increase Chart Data Accuracy (`src/hooks/useActivityLogs.tsx`)

For "This Week" view, 5,000 rows should be sufficient. But for "This Month" with many employees, we may still hit the limit. As a safeguard, we can add pagination or rely on the server-side RPC for chart data too -- but the simplest fix for now is ensuring the daily breakdown pre-fills all expected days.

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Analytics.tsx` | Rewrite `dailyData` to pre-populate all days in the range and sort chronologically |

### Technical Details

**Updated `dailyData` logic (lines 218-235 of Analytics.tsx):**

```text
1. Generate all dates between startDate and endDate
2. For each date, create a key using format(date, 'EEE dd') for weeks or 'EEE' for shorter ranges
3. Initialize each day with { working: 0, idle: 0 }
4. Loop through logs and add durations to the matching day
5. Return array in chronological order (not random object key order)
```

This ensures:
- "This Week" always shows Sun, Mon, Tue, Wed, Thu, Fri, Sat
- "This Month" shows all dates in the month
- "Today" shows just today
- Days with no data appear as empty bars (zero height) rather than being hidden

**Import addition:** Add `eachDayOfInterval` from `date-fns` to generate the full range of dates.
