CREATE UNIQUE INDEX "agent_runs_one_running_per_step" ON "agent_runs"("ticket_id", "step") WHERE "status" = 'RUNNING';
