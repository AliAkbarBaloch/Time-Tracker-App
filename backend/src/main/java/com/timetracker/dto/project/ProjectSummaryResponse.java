package com.timetracker.dto.project;

import java.time.Instant;
import java.util.List;

/**
 * Projection returned by GET /api/projects/{id}/summary.
 *
 * Extended for US-023:
 *  - TaskSummary now carries the owner's userId/userName so the frontend
 *    can display who logged each entry on shared projects.
 *  - contributions provides a per-user breakdown (userId, displayName,
 *    totalSeconds) that powers the Contributors card and the user-filter
 *    dropdown on the project detail page.
 *
 * Extended for US-026 (Time Budgets):
 *  - budgetHours: optional budget in hours (null = no budget)
 *  - usedHours: total tracked hours (derived from totalSeconds)
 *  - budgetPercent: usedHours / budgetHours * 100 (null when no budget)
 *  - budgetStatus: ON_TRACK / WARNING / OVER_BUDGET (null when no budget)
 */
public record ProjectSummaryResponse(
        Long id,
        String name,
        String description,
        Long parentId,
        long totalSeconds,
        List<SubprojectSummary> subprojects,
        List<TaskSummary> tasks,
        List<UserContribution> contributions,  // per-user breakdown (US-023)
        Double budgetHours,                    // US-026: null when no budget
        Double usedHours,                      // US-026: totalSeconds / 3600
        Double budgetPercent,                  // US-026: null when no budget
        String budgetStatus                    // US-026: ON_TRACK / WARNING / OVER_BUDGET / null
) {
    public record SubprojectSummary(Long id, String name, long totalSeconds) {}

    /**
     * Single task entry in the summary.
     * userId / userName allow the frontend to show the task owner's name
     * without a second request, and to match tasks to filter-dropdown entries.
     */
    public record TaskSummary(
            Long id,
            String description,
            Instant startTime,
            Instant endTime,
            boolean running,
            Long userId,      // task owner's user id  (US-023)
            String userName   // task owner's display name (US-023)
    ) {}

    /**
     * One row in the Contributors card: how many seconds a specific user
     * contributed to this project (across the entire subtree, deduplicated).
     */
    public record UserContribution(Long userId, String displayName, long totalSeconds) {}
}
