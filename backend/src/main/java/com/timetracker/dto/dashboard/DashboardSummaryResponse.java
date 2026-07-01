package com.timetracker.dto.dashboard;

import com.timetracker.dto.task.TaskResponse;

import java.util.List;

public record DashboardSummaryResponse(
        long todaySeconds,
        long weekSeconds,
        TaskResponse runningTask,
        List<TopProject> topProjects
) {
    /** Extended for US-026: budget fields are null when no budget is set on the project. */
    public record TopProject(
            Long id,
            String name,
            long weekSeconds,
            Double budgetHours,
            Double usedHours,
            Double budgetPercent,
            String budgetStatus
    ) {}
}
