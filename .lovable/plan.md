

## Individual CSV Export & Enhanced Application Chart

### Overview
Add per-employee CSV download buttons and enhance the application usage bar chart visualization.

---

### Changes to Analytics Page (`src/pages/Analytics.tsx`)

#### 1. Create Employee-Specific CSV Export Function

Add a new function that exports data for a single employee:

```typescript
const exportEmployeeCSV = (employeeId: string, employeeName: string) => {
  const employeeLogs = logs.filter(log => log.employee_id === employeeId);
  
  const headers = ['App', 'Status', 'Duration (seconds)', 'Duration (formatted)', 'Timestamp'];
  const rows = employeeLogs.map(log => [
    log.app_name,
    log.status,
    log.duration_seconds,
    formatDuration(log.duration_seconds),
    log.created_at
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${employeeName.replace(/\s+/g, '-')}-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

#### 2. Add Download Button to Each Employee Row

Update the Employee Productivity Ranking section to include download buttons:

```tsx
{employeeRanking.slice(0, 10).map((emp, index) => (
  <div key={emp.id} className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      {/* Rank badge */}
      <span className={cn(...)}>
        {index + 1}
      </span>
      <span className="font-medium">{emp.name}</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="text-right">
        <span className="font-bold text-primary">{emp.score}%</span>
        <span className="text-sm text-muted-foreground ml-2">({emp.hours}h)</span>
      </div>
      {/* NEW: Download button for this employee */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => exportEmployeeCSV(emp.id, emp.name)}
        title={`Download ${emp.name}'s activity report`}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  </div>
))}
```

#### 3. Enhance the Top Applications Bar Chart

Convert the existing horizontal bar chart to a more visually appealing vertical bar chart with better labeling:

```tsx
<Card className="lg:col-span-2">
  <CardHeader>
    <CardTitle>Application Usage Time</CardTitle>
  </CardHeader>
  <CardContent>
    {appUsageData.length === 0 ? (
      <p className="text-muted-foreground text-center py-8">No data for selected period</p>
    ) : (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={appUsageData}>
          <XAxis 
            dataKey="name" 
            angle={-45} 
            textAnchor="end" 
            height={80}
            interval={0}
          />
          <YAxis 
            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            tickFormatter={(v) => `${(v / 3600).toFixed(1)}h`}
          />
          <Tooltip 
            formatter={(value: number) => [formatDuration(value), 'Time Used']} 
          />
          <Bar 
            dataKey="value" 
            radius={[4, 4, 0, 0]}
          >
            {appUsageData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )}
  </CardContent>
</Card>
```

---

### Optional: Add Download Button to EmployeeDetail Page

Also add a CSV export button to the individual employee detail page (`src/pages/EmployeeDetail.tsx`) in the header section:

```tsx
<Button variant="outline" size="sm" onClick={handleExportCSV}>
  <Download className="h-4 w-4 mr-2" />
  Export CSV
</Button>
```

With the export function:
```typescript
const handleExportCSV = () => {
  const headers = ['App', 'Status', 'Duration (seconds)', 'Duration (formatted)', 'Timestamp'];
  const rows = logs.map(log => [
    log.app_name,
    log.status,
    log.duration_seconds,
    formatDuration(log.duration_seconds),
    log.created_at
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${employee?.name.replace(/\s+/g, '-')}-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Analytics.tsx` | Add `exportEmployeeCSV` function, add download buttons to employee ranking, enhance bar chart |
| `src/pages/EmployeeDetail.tsx` | Add CSV export button and function |

---

### Result

After implementation:
- Each employee in the productivity ranking will have a download icon button
- Clicking it downloads a CSV with only that employee's activity data
- The application usage chart will be more colorful and easier to read
- Employee detail page will also have an export option

