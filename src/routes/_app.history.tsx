import { createFileRoute } from "@tanstack/react-router";
import { TaskList } from "@/modules/history/components/task-list";
export const Route = createFileRoute("/_app/history")({ component: TaskList });
