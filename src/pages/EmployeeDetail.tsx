import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusBadge } from '@/components/employees/StatusBadge';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { useScreenshots } from '@/hooks/useScreenshots';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeft, Key, Copy, Trash2, RefreshCw, Clock, Activity, Image, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployees } from '@/hooks/useEmployees';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { deleteEmployee, regenerateApiKey } = useEmployees();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const { logs, appUsage, totalWorkingTime, totalIdleTime } = useActivityLogs({ employeeId: id });
  const { screenshots, getSignedUrl } = useScreenshots({ employeeId: id });
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Employee not found', variant: 'destructive' });
        navigate('/employees');
      } else {
        setEmployee(data as Employee);
      }
      setLoading(false);
    };

    fetchEmployee();

    // Real-time updates for this employee
    const channel = supabase
      .channel(`employee-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employees', filter: `id=eq.${id}` },
        (payload) => setEmployee(payload.new as Employee)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Load screenshot signed URLs
  useEffect(() => {
    screenshots.forEach(async (ss) => {
      if (!screenshotUrls[ss.id]) {
        const url = await getSignedUrl(ss.image_path);
        if (url) {
          setScreenshotUrls(prev => ({ ...prev, [ss.id]: url }));
        }
      }
    });
  }, [screenshots]);

  const handleCopyApiKey = () => {
    if (employee?.api_key) {
      navigator.clipboard.writeText(employee.api_key);
      toast({ title: 'API key copied to clipboard' });
    }
  };

  const handleRegenerateKey = async () => {
    if (!employee) return;
    const newKey = await regenerateApiKey(employee.id);
    if (newKey) {
      setEmployee(prev => prev ? { ...prev, api_key: newKey } : null);
    }
  };

  const handleDelete = async () => {
    if (!employee) return;
    if (window.confirm(`Are you sure you want to delete ${employee.name}?`)) {
      const success = await deleteEmployee(employee.id);
      if (success) {
        navigate('/employees');
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleExportCSV = () => {
    if (!employee) return;
    
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
    a.download = `${employee.name.replace(/\s+/g, '-')}-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const appUsageData = Object.entries(appUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const timeData = [
    { name: 'Working', value: totalWorkingTime },
    { name: 'Idle', value: totalIdleTime }
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!employee) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{employee.name}</h1>
              <StatusBadge status={employee.status} />
            </div>
            <p className="text-muted-foreground">{employee.employee_code}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Seen</p>
                  <p className="font-medium">
                    {employee.last_seen
                      ? formatDistanceToNow(new Date(employee.last_seen), { addSuffix: true })
                      : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Current App</p>
                  <p className="font-medium">{employee.current_app || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">API Key</p>
                    <p className="font-mono text-sm">
                      {showApiKey ? employee.api_key : '••••••••••••'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                    <Key className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCopyApiKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRegenerateKey}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No activity recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {logs.slice(0, 50).map(log => (
                      <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{log.app_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={log.status === 'working' ? 'online' : 'idle'} animated={false} />
                          <p className="text-sm text-muted-foreground">{formatDuration(log.duration_seconds)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charts" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  {appUsageData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={appUsageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name }) => name}
                        >
                          {appUsageData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatDuration(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Working vs Idle Time</CardTitle>
                </CardHeader>
                <CardContent>
                  {totalWorkingTime === 0 && totalIdleTime === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={timeData}>
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => formatDuration(v)} />
                        <Tooltip formatter={(value: number) => formatDuration(value)} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {timeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#F59E0B'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="screenshots" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Screenshots
                </CardTitle>
              </CardHeader>
              <CardContent>
                {screenshots.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No screenshots captured yet</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {screenshots.map(ss => (
                      <div key={ss.id} className="group relative aspect-video rounded-lg overflow-hidden bg-muted">
                        {screenshotUrls[ss.id] ? (
                          <img
                            src={screenshotUrls[ss.id]}
                            alt="Screenshot"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Skeleton className="w-full h-full" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-white text-xs">
                            {format(new Date(ss.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
