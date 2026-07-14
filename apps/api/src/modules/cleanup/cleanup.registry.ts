import { Injectable } from '@nestjs/common';
import { type CleanupTask } from './types/cleanup-task.interface';

@Injectable()
export class CleanupRegistry {
  private readonly tasks: CleanupTask[] = [];

  register(task: CleanupTask): void {
    this.tasks.push(task);
  }

  getAll(): readonly CleanupTask[] {
    return this.tasks;
  }
}
