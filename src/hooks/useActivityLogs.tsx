import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActivityLog } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { isProductiveApp } from '@/lib/productiveApps';

interface UseActivityLogsOptions {
  employeeId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLogs = async () => {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.employeeId) {
      query = query.eq('employee_id', options.employeeId);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: 'Error fetching activity logs',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      setLogs(data as ActivityLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    // Real-time subscription
    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          const newLog = payload.new as ActivityLog;
          if (!options.employeeId || newLog.employee_id === options.employeeId) {
            setLogs(prev => [newLog, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.employeeId, options.startDate?.getTime(), options.endDate?.getTime()]);

  // Calculate stats
  const appUsage = logs.reduce((acc, log) => {
    acc[log.app_name] = (acc[log.app_name] || 0) + log.duration_seconds;
    return acc;
  }, {} as Record<string, number>);

  const totalWorkingTime = logs
    .filter(l => isProductiveApp(l.app_name))
    .reduce((acc, l) => acc + l.duration_seconds, 0);

  const totalIdleTime = logs
    .filter(l => !isProductiveApp(l.app_name))
    .reduce((acc, l) => acc + l.duration_seconds, 0);

  return {
    logs,
    loading,
    appUsage,
    totalWorkingTime,
    totalIdleTime,
    refetch: fetchLogs
  };
}
