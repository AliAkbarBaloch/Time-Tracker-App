package com.timetracker.dto.analytics;

import java.util.List;

public record SharedBreakdownResponse(
        int weeks,
        List<ProjectContribution> projects
) {
    public record ProjectContribution(
            long projectId,
            String projectName,
            List<UserContribution> contributions
    ) {}

    public record UserContribution(
            String userName,
            long totalSeconds,
            double percentage
    ) {}
}
