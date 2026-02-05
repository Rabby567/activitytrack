

## Fix Employee Detail Page Chart Colors

### Problem
The Employee Detail page charts are showing black because they use CSS variable colors that don't resolve properly in Recharts:
- **Top Applications pie chart**: Uses `hsl(var(--chart-1))`, `hsl(var(--chart-2))`, etc.
- **Working vs Idle bar chart**: Uses `hsl(var(--primary))`

### Solution

Update `src/pages/EmployeeDetail.tsx` to use explicit hex colors:

#### 1. Update COLORS Array (Line 19)

Replace CSS variables with vibrant hex colors:

| Current | New |
|---------|-----|
| `hsl(var(--chart-1))` | `#3B82F6` (Blue) |
| `hsl(var(--chart-2))` | `#10B981` (Green) |
| `hsl(var(--chart-3))` | `#F59E0B` (Yellow) |
| `hsl(var(--chart-4))` | `#EF4444` (Red) |
| `hsl(var(--chart-5))` | `#8B5CF6` (Purple) |

#### 2. Update Bar Chart Colors (Line 319-325)

Add individual Cell components with distinct colors for Working (Green) and Idle (Amber):

- **Working bar**: `#10B981` (Green)
- **Idle bar**: `#F59E0B` (Amber)

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/EmployeeDetail.tsx` | Replace COLORS array with hex colors, update bar chart to use Cell components with explicit colors |

### Result

After implementation:
- Top Applications pie chart will show 5 distinct vibrant colors
- Working vs Idle bar chart will show green for Working and amber for Idle
- Charts will match the Analytics page styling

