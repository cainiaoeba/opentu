import { TaskStatus, type Task } from '../types/task.types';

export function getInterruptedProcessingTasks(
  storedTasks: Task[],
  liveTaskIdsBeforeRestore: ReadonlySet<string>,
  pageStartedAt: number
): Task[] {
  return storedTasks.filter(
    (task) =>
      task.status === TaskStatus.PROCESSING &&
      !liveTaskIdsBeforeRestore.has(task.id) &&
      // A newly persisted task may be read before it is registered in memory.
      // Only work from a previous page session is eligible for recovery.
      task.createdAt < pageStartedAt
  );
}
