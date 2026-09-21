import { describe, expect, it } from 'vitest';
import { TaskStatus, TaskType, type Task } from '../types/task.types';
import { getInterruptedProcessingTasks } from './task-storage-recovery';

function createTask(id: string, status: TaskStatus): Task {
  const now = 1000;
  return {
    id,
    type: TaskType.IMAGE,
    status,
    params: { prompt: id },
    createdAt: now,
    updatedAt: now,
  };
}

describe('getInterruptedProcessingTasks', () => {
  it('does not mark a first-generation task created during startup as interrupted', () => {
    const firstGeneration = createTask('first-generation', TaskStatus.PROCESSING);
    const staleTask = createTask('stale-processing', TaskStatus.PROCESSING);
    staleTask.createdAt = 900;
    const completedTask = createTask('completed', TaskStatus.COMPLETED);

    const interrupted = getInterruptedProcessingTasks(
      [firstGeneration, staleTask, completedTask],
      new Set([firstGeneration.id]),
      950
    );

    expect(interrupted.map((task) => task.id)).toEqual([staleTask.id]);
  });

  it('keeps a new task that reached storage before it appeared in memory', () => {
    const firstGeneration = createTask('first-generation', TaskStatus.PROCESSING);
    const staleTask = createTask('stale-processing', TaskStatus.PROCESSING);
    staleTask.createdAt = 900;

    const interrupted = getInterruptedProcessingTasks(
      [firstGeneration, staleTask],
      new Set(),
      950
    );

    expect(interrupted.map((task) => task.id)).toEqual([staleTask.id]);
  });
});
