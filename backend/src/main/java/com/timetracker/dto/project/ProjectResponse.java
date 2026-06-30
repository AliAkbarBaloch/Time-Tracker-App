package com.timetracker.dto.project;

import com.timetracker.entity.Project;

import java.time.Instant;

public record ProjectResponse(Long id, String name, String description, Instant createdAt) {

    public static ProjectResponse from(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getCreatedAt()
        );
    }
}
