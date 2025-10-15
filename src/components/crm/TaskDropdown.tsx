import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar as CalendarIcon, Loader2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  task_type: string;
  priority: string;
  due_date?: string | null;
}

interface TaskDropdownProps {
  customerId?: string;
  quoteId?: string;
  task?: Task;
  mode?: 'create' | 'edit';
  onTaskCreated?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function TaskDropdown({
  customerId,
  quoteId,
  task,
  mode = 'create',
  onTaskCreated,
  variant = 'default',
  size = 'default',
  className,
}: TaskDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [taskType, setTaskType] = useState<string>(task?.task_type || 'follow_up');
  const [priority, setPriority] = useState<string>(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task?.due_date ? new Date(task.due_date) : undefined
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTaskType('follow_up');
    setPriority('medium');
    setDueDate(undefined);
  };

  const handleSaveTask = async () => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Task title is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (mode === 'edit' && task) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            task_type: taskType,
            priority: priority,
            due_date: dueDate?.toISOString() || null,
          })
          .eq('id', task.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Task updated successfully',
        });
      } else {
        // Create new task
        const { data: contractorId, error: contractorError } = await supabase.rpc(
          'get_current_contractor_id'
        );

        if (contractorError) throw contractorError;
        if (!contractorId) throw new Error('Contractor not found');

        const { error } = await supabase.from('tasks').insert({
          contractor_id: contractorId,
          customer_id: customerId || null,
          quote_id: quoteId || null,
          title: title.trim(),
          description: description.trim() || null,
          task_type: taskType,
          priority: priority,
          status: 'pending',
          due_date: dueDate?.toISOString() || null,
        });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Task created successfully',
        });
      }

      resetForm();
      setOpen(false);
      onTaskCreated?.();
    } catch (error: any) {
      console.error('Error saving task:', error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${mode} task`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {mode === 'edit' ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label htmlFor="task-type" className="text-sm font-medium">
              Type
            </Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger id="task-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="site_visit">Site Visit</SelectItem>
                <SelectItem value="quote_review">Quote Review</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="task-priority" className="text-sm font-medium">
              Priority
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Due Date</Label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date);
                    setShowCalendar(false);
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="task-description"
              placeholder="Add details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSaveTask}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === 'edit' ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                mode === 'edit' ? 'Update Task' : 'Create Task'
              )}
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
