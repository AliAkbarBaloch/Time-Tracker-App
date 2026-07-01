package com.timetracker.dto.project;

import java.time.Instant;
import java.util.List;

public record ProjectSummaryResponse(
        Long id,
        String name,
        String description,
        Long parentId,
        long totalSeconds,
        List<SubprojectSummary> subprojects,
        List<TaskSummary> tasks
) {
    public record SubprojectSummary(Long id, String name, long totalSeconds) {}

    public record TaskSummary(Long id, String description, Instant startTime, Instant endTime, boolean running) {}
}
