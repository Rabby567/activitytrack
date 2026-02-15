

## Redefine "Working" vs "Idle" Based on Application Name

### Problem
Currently, "working" and "idle" are determined by the `status` field in the database, which is based on keyboard/mouse activity. The user wants a different definition:

- **Working**: Only time spent in **Adobe Photoshop**, **Adobe InDesign**, or **Adobe Illustrator**
- **Idle**: Time spent in **all other applications**

This affects stats (Total Hours, Productive Time, Idle Time, Productivity Score) and charts across both the Analytics and Employee Detail pages.

### Solution

#### 1. Create a shared helper function (`src/lib/productiveApps.ts`)

A utility that checks if a given app name (raw window title) belongs to a "productive" app:

| Productive App | Detection Methods |
|---------------|-------------------|
| Adobe Photoshop | `.psd`, `.psb` extensions, or "Photoshop" in title |
| Adobe InDesign | `.indd` extension, or "InDesign" in title |
| Adobe Illustrator | `.ai` extension, or "Illustrator" in title |

#### 2. Update `useActivityLogs` hook

Change how `totalWorkingTime` and `totalIdleTime` are calculated:

- **Currently**: Uses `log.status === 'working'` (keyboard/mouse activity)
- **Updated**: Uses `isProductiveApp(log.app_name)` to classify

This means all stats cards (Total Hours, Productive Time, Idle Time, Productivity Score) will automatically reflect the new logic everywhere the hook is used.

#### 3. Update `Analytics.tsx` - Daily Activity Breakdown

Change the daily breakdown chart to classify logs by app name instead of status:

- **Working hours**: Sum of duration where app is Photoshop/InDesign/Illustrator
- **Idle hours**: Sum of duration for all other apps
- Fix bar colors: Working = green (#10B981), Idle = amber (#F59E0B) -- remove per-day Cell components

#### 4. Update `Analytics.tsx` - Employee Ranking

Update the employee productivity ranking to use the same app-based classification.

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/lib/productiveApps.ts` | **New file** -- `isProductiveApp()` helper function |
| `src/hooks/useActivityLogs.tsx` | Change `totalWorkingTime`/`totalIdleTime` to use app-based classification |
| `src/pages/Analytics.tsx` | Update `dailyData` and `employeeRanking` to use app-based classification; fix daily chart bar colors |

### Technical Details

**isProductiveApp function logic:**
```text
function isProductiveApp(appName: string): boolean
  1. Convert to lowercase
  2. Check file extensions: .psd, .psb, .indd, .ai
  3. Check name patterns: "photoshop", "indesign", "illustrator"
  4. Return true if any match, false otherwise
```

**useActivityLogs changes (lines 78-84):**
```text
Before: filter by log.status === 'working' / 'idle'
After:  filter by isProductiveApp(log.app_name) true/false
```

**Analytics.tsx dailyData changes (lines 218-235):**
```text
Before: if (log.status === 'working') -> working hours
After:  if (isProductiveApp(log.app_name)) -> working hours
Also: Remove Cell components from daily bars, use fill="#10B981" and fill="#F59E0B" directly
```

