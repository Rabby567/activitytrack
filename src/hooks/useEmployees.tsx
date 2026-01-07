import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    
    if (error) {
      toast({
        title: 'Error fetching employees',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      setEmployees(data as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();

    // Real-time subscription
    const channel = supabase
      .channel('employees-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEmployees(prev => [...prev, payload.new as Employee]);
            toast({ title: 'New employee added', description: (payload.new as Employee).name });
          } else if (payload.eventType === 'UPDATE') {
            setEmployees(prev => 
              prev.map(emp => emp.id === payload.new.id ? payload.new as Employee : emp)
            );
          } else if (payload.eventType === 'DELETE') {
            setEmployees(prev => prev.filter(emp => emp.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addEmployee = async (name: string, employeeCode: string, deviceName?: string) => {
    const { data, error } = await supabase
      .from('employees')
      .insert({ name, employee_code: employeeCode, device_name: deviceName })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error adding employee', description: error.message, variant: 'destructive' });
      return null;
    }
    return data as Employee;
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    const { error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Error updating employee', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const deleteEmployee = async (id: string) => {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error deleting employee', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const regenerateApiKey = async (id: string) => {
    const newApiKey = crypto.randomUUID();
    const { error } = await supabase
      .from('employees')
      .update({ api_key: newApiKey })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error regenerating API key', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'API key regenerated' });
    return newApiKey;
  };

  const stats = {
    total: employees.length,
    online: employees.filter(e => e.status === 'online').length,
    idle: employees.filter(e => e.status === 'idle').length,
    offline: employees.filter(e => e.status === 'offline').length,
  };

  return {
    employees,
    loading,
    stats,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    regenerateApiKey,
    refetch: fetchEmployees
  };
}
