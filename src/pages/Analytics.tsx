import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEmployees } from '@/hooks/useEmployees';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarIcon, Download, Clock, TrendingUp, BarChart3, PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type DateRange = 'today' | 'week' | 'month' | 'custom';

export default function Analytics() {
  const { employees } = useEmployees();
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'week':
        return { startDate: startOfWeek(now), endDate: endOfWeek(now) };
      case 'month':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'custom':
        return { startDate: customStart, endDate: customEnd };
      default:
        return { startDate: subDays(now, 7), endDate: now };
    }
  }, [dateRange, customStart, customEnd]);

  const { logs, appUsage, totalWorkingTime, totalIdleTime } = useActivityLogs({
    employeeId: selectedEmployee === 'all' ? undefined : selectedEmployee,
    startDate,
    endDate
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatHours = (seconds: number) => {
    return (seconds / 3600).toFixed(1);
  };

  // Prepare chart data
  const appUsageData = Object.entries(appUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.slice(0, 15), value, hours: (value / 3600).toFixed(1) }));

  const productivityData = [
    { name: 'Working', value: totalWorkingTime, color: 'hsl(var(--chart-1))' },
    { name: 'Idle', value: totalIdleTime, color: 'hsl(var(--chart-2))' }
  ];

  const productivityScore = totalWorkingTime + totalIdleTime > 0
    ? Math.round((totalWorkingTime / (totalWorkingTime + totalIdleTime)) * 100)
    : 0;

  // Daily breakdown
  const dailyData = useMemo(() => {
    const days: Record<string, { working: number; idle: number }> = {};
    logs.forEach(log => {
      const day = format(new Date(log.created_at), 'EEE');
      if (!days[day]) days[day] = { working: 0, idle: 0 };
      if (log.status === 'working') {
        days[day].working += log.duration_seconds / 3600;
      } else {
        days[day].idle += log.duration_seconds / 3600;
      }
    });
    return Object.entries(days).map(([name, data]) => ({
      name,
      working: Number(data.working.toFixed(1)),
      idle: Number(data.idle.toFixed(1))
    }));
  }, [logs]);

  // Employee productivity ranking
  const employeeRanking = useMemo(() => {
    const ranking: Record<string, { working: number; idle: number; name: string }> = {};
    
    logs.forEach(log => {
      const emp = employees.find(e => e.id === log.employee_id);
      if (!emp) return;
      
      if (!ranking[log.employee_id]) {
        ranking[log.employee_id] = { working: 0, idle: 0, name: emp.name };
      }
      
      if (log.status === 'working') {
        ranking[log.employee_id].working += log.duration_seconds;
      } else {
        ranking[log.employee_id].idle += log.duration_seconds;
      }
    });

    return Object.entries(ranking)
      .map(([id, data]) => ({
        id,
        name: data.name,
        score: data.working + data.idle > 0
          ? Math.round((data.working / (data.working + data.idle)) * 100)
          : 0,
        hours: (data.working / 3600).toFixed(1)
      }))
      .sort((a, b) => b.score - a.score);
  }, [logs, employees]);

  const exportToCSV = () => {
    const headers = ['Employee', 'App', 'Status', 'Duration (seconds)', 'Timestamp'];
    const rows = logs.map(log => {
      const emp = employees.find(e => e.id === log.employee_id);
      return [emp?.name || 'Unknown', log.app_name, log.status, log.duration_seconds, log.created_at];
    });
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Productivity Analytics</h1>
            <p className="text-muted-foreground">Analyze team performance and activity patterns</p>
          </div>
          <Button onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>

          {dateRange === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(!customStart && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, 'PPP') : 'Start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(!customEnd && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, 'PPP') : 'End date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{formatHours(totalWorkingTime + totalIdleTime)}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/10 p-3">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productive Time</p>
                  <p className="text-2xl font-bold">{formatHours(totalWorkingTime)}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-500/10 p-3">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Idle Time</p>
                  <p className="text-2xl font-bold">{formatHours(totalIdleTime)}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Productivity Score</p>
                  <p className="text-2xl font-bold">{productivityScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No data for selected period</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData}>
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="working" name="Working" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="idle" name="Idle" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Working vs Idle Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {totalWorkingTime === 0 && totalIdleTime === 0 ? (
                <p className="text-muted-foreground text-center py-8">No data for selected period</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={productivityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {productivityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatDuration(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {appUsageData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No data for selected period</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={appUsageData} layout="vertical">
                    <XAxis type="number" tickFormatter={(v) => `${v}h`} />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value: number) => formatDuration(value)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Productivity Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              {employeeRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No data for selected period</p>
              ) : (
                <div className="space-y-3">
                  {employeeRanking.slice(0, 10).map((emp, index) => (
                    <div key={emp.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                          index === 0 && 'bg-amber-500 text-white',
                          index === 1 && 'bg-gray-400 text-white',
                          index === 2 && 'bg-amber-700 text-white',
                          index > 2 && 'bg-muted text-muted-foreground'
                        )}>
                          {index + 1}
                        </span>
                        <span className="font-medium">{emp.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-primary">{emp.score}%</span>
                        <span className="text-sm text-muted-foreground ml-2">({emp.hours}h)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
