import type { Task } from '@/lib/schema';

type TaskStatusFilters = {
  pending: boolean;
  inProgress: boolean;
  completed: boolean;
  cancelled: boolean;
};

type TaskPriorityFilters = {
  low: boolean;
  medium: boolean;
  high: boolean;
  critical: boolean;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function resolveTaskRange(task: Pick<Task, 'dueAt' | 'startAt' | 'durationMinutes'>) {
  if (task.startAt && task.durationMinutes) {
    const taskStart = toDate(task.startAt);
    return {
      startAt: taskStart,
      endAt: new Date(taskStart.getTime() + task.durationMinutes * 60 * 1000),
    };
  }

  const taskDue = toDate(task.dueAt);
  return { startAt: taskDue, endAt: taskDue };
}

export function filterTasks<T extends Pick<Task, 'status' | 'priority'>>(
  tasks: T[],
  statusFilters: TaskStatusFilters,
  priorityFilters: TaskPriorityFilters
) {
  return tasks.filter((task) => {
    const statusMatch =
      (task.status === 'pending' && statusFilters.pending) ||
      (task.status === 'in_progress' && statusFilters.inProgress) ||
      (task.status === 'completed' && statusFilters.completed) ||
      (task.status === 'cancelled' && statusFilters.cancelled);
    if (!statusMatch) return false;

    return !!priorityFilters[task.priority];
  });
}
