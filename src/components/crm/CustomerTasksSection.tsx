import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar, Phone, Mail, Users, MapPin, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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

interface CustomerTasksSectionProps {
  customerId: string;
}

const taskTypeOptions = [
  { value: 'follow_up', label: 'Follow Up', icon: Clock },
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Send Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'site_visit', label: 'Site Visit', icon: MapPin },
];

const priorityOptions = [
  { value: 'low', label: 'Low', variant: 'outline' as const },
  { value: 'medium', label: 'Medium', variant: 'secondary' as const },
  { value: 'high', label: 'High', variant: 'default' as const },
  { value: 'urgent', label: 'Urgent', variant: 'destructive' as const },
];

export default function CustomerTasksSection({ customerId }: CustomerTasksSectionProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    task_type: "follow_up",
    priority: "medium",
    due_date: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [customerId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('customer_id', customerId)
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

  const addTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      setSaving(true);
      
      // Get contractor ID
      const { data: contractorData } = await supabase.rpc('get_current_contractor_id');
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          customer_id: customerId,
          contractor_id: contractorData,
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          task_type: newTask.task_type,
          priority: newTask.priority,
          due_date: newTask.due_date || null
        });

      if (error) throw error;

      setNewTask({
        title: "",
        description: "",
        task_type: "follow_up",
        priority: "medium",
        due_date: ""
      });
      fetchTasks();
      
      toast({
        title: "Task Created",
        description: "New task has been added",
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      {/* Add New Task */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Task
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
            <Input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
            />
          </div>
          
          <Textarea
            placeholder="Task description (optional)..."
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            rows={2}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select 
              value={newTask.task_type} 
              onValueChange={(value) => setNewTask({ ...newTask, task_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {taskTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={newTask.priority} 
              onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={addTask} 
              disabled={!newTask.title.trim() || saving}
              className="w-full"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks yet. Create the first task above.
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}