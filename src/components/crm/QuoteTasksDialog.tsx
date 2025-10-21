import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDropdown } from "./TaskDropdown";
import { toast } from "@/hooks/use-toast";
import { 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  Flag
} from "lucide-react";
import { format, isPast } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface QuoteTasksDialogProps {
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortOption = 'due_date' | 'priority' | 'status' | 'created_at';
type SortOrder = 'asc' | 'desc';

const taskTypeOptions = [
  { value: "follow_up", label: "Follow Up", icon: Phone },
  { value: "send_quote", label: "Send Quote", icon: Mail },
  { value: "schedule_meeting", label: "Schedule Meeting", icon: Calendar },
  { value: "site_visit", label: "Site Visit", icon: Calendar },
  { value: "review_quote", label: "Review Quote", icon: FileText },
  { value: "other", label: "Other", icon: AlertCircle },
];

const priorityOptions = [
  { value: "low", label: "Low", variant: "outline" as const },
  { value: "medium", label: "Medium", variant: "secondary" as const },
  { value: "high", label: "High", variant: "destructive" as const },
];

export function QuoteTasksDialog({ quoteId, quoteNumber, customerId, open, onOpenChange }: QuoteTasksDialogProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open, quoteId]);

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
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
      return;
    }

    fetchTasks();
  };

  const priorityValue = (priority: string): number => {
    const values: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return values[priority] || 0;
  };

  const statusValue = (status: string): number => {
    const values: Record<string, number> = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 };
    return values[status] || 0;
  };

  const sortByPriority = (a: Task, b: Task): number => {
    return priorityValue(b.priority) - priorityValue(a.priority);
  };

  const sortTasks = (tasks: Task[]): Task[] => {
    return [...tasks].sort((a, b) => {
      // Completed tasks always go to bottom
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;

      let comparison = 0;

      switch (sortBy) {
        case 'due_date':
          if (!a.due_date && !b.due_date) return sortByPriority(a, b);
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (comparison === 0) return sortByPriority(a, b);
          break;

        case 'priority':
          comparison = priorityValue(a.priority) - priorityValue(b.priority);
          break;

        case 'status':
          comparison = statusValue(a.status) - statusValue(b.status);
          break;

        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const getTaskTypeIcon = (type: string) => {
    const option = taskTypeOptions.find(opt => opt.value === type);
    return option ? option.icon : AlertCircle;
  };

  const getPriorityVariant = (priority: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option?.variant || "outline";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const sortedTasks = sortTasks(tasks);
  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const overdueCount = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'completed').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tasks for Quote {quoteNumber}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{pendingCount} pending</span>
            <span>•</span>
            <span>{completedCount} completed</span>
            {overdueCount > 0 && (
              <>
                <span>•</span>
                <span className="text-destructive font-medium">{overdueCount} overdue</span>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Sort by:</Label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="created_at">Created Date</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>

          <TaskDropdown
            quoteId={quoteId}
            customerId={customerId}
            onTaskCreated={fetchTasks}
            mode="create"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No tasks yet</p>
              <p className="text-sm">Add a task to get started</p>
            </div>
          ) : (
            sortedTasks.map((task) => {
              const TaskIcon = getTaskTypeIcon(task.task_type);
              const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';

              return (
                <div key={task.id} className="border rounded-lg p-4 space-y-2 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => toggleTaskCompletion(task.id, task.status)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h4>
                          <TaskIcon className="h-4 w-4 text-muted-foreground" />
                          <Badge variant={getPriorityVariant(task.priority)} className="text-xs">
                            {task.priority}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(task.status)} className="text-xs">
                            {task.status.replace('_', ' ')}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <Flag className="h-3 w-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <TaskDropdown
                          quoteId={quoteId}
                          customerId={customerId}
                          task={task}
                          onTaskCreated={fetchTasks}
                          mode="edit"
                        />
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created {format(new Date(task.created_at), 'MMM d, yyyy')}</span>
                        {task.due_date && (
                          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                            Due {format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                        {task.completed_at && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed {format(new Date(task.completed_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
