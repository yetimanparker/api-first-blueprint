import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Users, MapPin, Clock, CheckCircle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { TaskDropdown } from "./TaskDropdown";

interface Task {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  status: string;
  priority: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

interface QuoteTasksSectionProps {
  quoteId: string;
}

const taskTypeOptions = [
  { value: 'follow_up', label: 'Follow Up', icon: Clock },
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Send Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'site_visit', label: 'Site Visit', icon: MapPin },
  { value: 'quote_review', label: 'Quote Review', icon: Clock },
];

const priorityOptions = [
  { value: 'low', label: 'Low', variant: 'outline' as const },
  { value: 'medium', label: 'Medium', variant: 'secondary' as const },
  { value: 'high', label: 'High', variant: 'default' as const },
];

export default function QuoteTasksSection({ quoteId }: QuoteTasksSectionProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [quoteId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompletion = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          completed_at: completedAt
        })
        .eq('id', taskId);

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const getTaskTypeIcon = (type: string) => {
    const option = taskTypeOptions.find(opt => opt.value === type);
    return option ? option.icon : Clock;
  };

  const getPriorityVariant = (priority: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option ? option.variant : 'secondary';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading tasks...</div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No tasks for this quote yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
          {tasks.map((task) => {
            const IconComponent = getTaskTypeIcon(task.task_type);
            const isCompleted = task.status === 'completed';
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;
            
            return (
              <div key={task.id} className={`border rounded-lg p-4 ${isCompleted ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() => toggleTaskCompletion(task.id, task.status)}
                    />
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <h3 className={`font-medium ${isCompleted ? 'line-through' : ''}`}>
                        {task.title}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityVariant(task.priority)}>
                      {task.priority}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(task.status)}>
                      {task.status}
                    </Badge>
                    {isOverdue && (
                      <Badge variant="destructive">Overdue</Badge>
                    )}
                    <TaskDropdown
                      task={task}
                      mode="edit"
                      quoteId={quoteId}
                      onTaskCreated={fetchTasks}
                      variant="ghost"
                      size="sm"
                      className="h-8"
                    />
                  </div>
                </div>
                
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-3 ml-8">
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-sm text-muted-foreground ml-8">
                  <div className="flex items-center gap-4">
                    <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                    {task.due_date && (
                      <span className={isOverdue ? 'text-red-600' : ''}>
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {task.completed_at && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Completed {new Date(task.completed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
  );
}
