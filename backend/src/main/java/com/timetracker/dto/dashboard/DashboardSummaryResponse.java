package com.timetracker.dto.dashboard;

import com.timetracker.dto.task.TaskResponse;

import java.util.List;

public record DashboardSummaryResponse(
        long todaySeconds,
        long weekSeconds,
        TaskResponse runningTask,
        List<TopProject> topProjects
) {
    public record TopProject(Long id, String name, long weekSeconds) {}
}
