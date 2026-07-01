package com.timetracker.dto.project;

import com.timetracker.entity.Project;
import com.timetracker.entity.Task;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Response DTO for a project tree node.
 * The `shared` flag is true when the requesting user is a MEMBER (not the OWNER),
 * allowing the frontend to display a visual badge for shared projects.
 */
public record ProjectResponse(
        Long id,
        String name,
        String description,
        Long parentId,
        List<ProjectResponse> subprojects,
        long totalSeconds,
        Instant createdAt,
        boolean shared   // true when current user is a MEMBER, not the OWNER
) {

    /** Convenience factory for owned projects (shared = false). */
    public static ProjectResponse from(Project project) {
        return from(project, false);
    }

    /**
     * Full factory used by ProjectService.listProjects to set the shared flag correctly
     * depending on whether the requesting user is the owner or an invited member.
     */
    public static ProjectResponse from(Project project, boolean shared) {
        Set<Long> seen = new HashSet<>();
        return buildResponse(project, seen, shared);
    }

    private static ProjectResponse buildResponse(Project project, Set<Long> seen, boolean shared) {
        long total = collectSeconds(project, seen);
        // Subprojects are always owned, so shared=false for children
        List<ProjectResponse> subs = project.getSubprojects().stream()
                .map(child -> {
                    Set<Long> childSeen = new HashSet<>();
                    return buildResponse(child, childSeen, false);
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
                project.getCreatedAt(),
                shared
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
