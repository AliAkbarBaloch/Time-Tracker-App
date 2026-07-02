package com.timetracker.dto.task;

import com.timetracker.entity.Task;

import java.time.Instant;
import java.util.List;

public record TaskResponse(
        Long id,
        String description,
        Instant startTime,
        Instant endTime,
        boolean running,
        List<ProjectInfo> projects,
        long totalPreviousSeconds
) {
    public record ProjectInfo(Long id, String name) {}

    public static TaskResponse from(Task task) {
        List<ProjectInfo> projectList = task.getProjects().stream()
                .map(p -> new ProjectInfo(p.getId(), p.getName()))
                .sorted(java.util.Comparator.comparing(ProjectInfo::id))
                .toList();
        return new TaskResponse(
                task.getId(),
                task.getDescription(),
                task.getStartTime(),
                task.getEndTime(),
                task.isRunning(),
                projectList,
                task.getTotalPreviousSeconds()
        );
    }
}
