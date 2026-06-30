package com.timetracker.dto.project;

import com.timetracker.entity.Project;
import com.timetracker.entity.Task;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record ProjectResponse(
        Long id,
        String name,
        String description,
        Long parentId,
        List<ProjectResponse> subprojects,
        long totalSeconds,
        Instant createdAt
) {

    public static ProjectResponse from(Project project) {
        Set<Long> seen = new HashSet<>();
        return buildResponse(project, seen);
    }

    private static ProjectResponse buildResponse(Project project, Set<Long> seen) {
        long total = collectSeconds(project, seen);
        List<ProjectResponse> subs = project.getSubprojects().stream()
                .map(child -> {
                    Set<Long> childSeen = new HashSet<>();
                    return buildResponse(child, childSeen);
                })
                .toList();
        Long parentId = project.getParent() != null ? project.getParent().getId() : null;
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                parentId,
                subs,
                total,
                project.getCreatedAt()
        );
    }

    private static long collectSeconds(Project project, Set<Long> seen) {
        long total = 0;
        for (Task task : project.getTasks()) {
            if (seen.add(task.getId()) && task.getEndTime() != null) {
                total += task.getEndTime().getEpochSecond() - task.getStartTime().getEpochSecond();
            }
        }
        for (Project child : project.getSubprojects()) {
            total += collectSeconds(child, seen);
        }
        return total;
    }
}
