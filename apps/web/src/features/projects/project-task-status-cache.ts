import type {
  ProjectTaskScheduleResponse,
  ProjectTaskStatus,
} from "@/lib/api/generated/models";

const countKey = {
  pending: "pending",
  in_progress: "inProgress",
  blocked: "blocked",
  completed: "completed",
} as const satisfies Record<
  ProjectTaskStatus,
  keyof ProjectTaskScheduleResponse["stages"][number]["taskStatusCounts"]
>;

export function updateTaskStatusInSchedule(
  schedule: ProjectTaskScheduleResponse,
  taskId: string,
  status: ProjectTaskStatus,
) {
  const stageIndex = schedule.stages.findIndex((stage) =>
    stage.tasks.some((task) => task.id === taskId),
  );
  if (stageIndex === -1) return schedule;

  const stage = schedule.stages[stageIndex];
  const taskIndex = stage.tasks.findIndex((task) => task.id === taskId);
  const task = stage.tasks[taskIndex];
  if (task.status === status) return schedule;

  const previousKey = countKey[task.status];
  const nextKey = countKey[status];
  const stages = [...schedule.stages];
  const tasks = [...stage.tasks];
  tasks[taskIndex] = { ...task, status };
  stages[stageIndex] = {
    ...stage,
    tasks,
    taskStatusCounts: {
      ...stage.taskStatusCounts,
      [previousKey]: Math.max(0, stage.taskStatusCounts[previousKey] - 1),
      [nextKey]: stage.taskStatusCounts[nextKey] + 1,
    },
  };

  return { ...schedule, stages };
}
