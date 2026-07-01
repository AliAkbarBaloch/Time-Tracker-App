package com.timetracker.dto.template;

import com.timetracker.entity.TaskTemplate;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

public record TemplateResponse(
    Long id,
    String name,
    String description,
    List<ProjectRef> projects,
    Instant createdAt
) {
    public record ProjectRef(Long id, String name) {}

    public static TemplateResponse from(TaskTemplate t) {
        List<ProjectRef> projects = t.getProjects().stream()
            .map(p -> new ProjectRef(p.getId(), p.getName()))
            .sorted(Comparator.comparing(ProjectRef::id))
            .toList();
        return new TemplateResponse(t.getId(), t.getName(), t.getDescription(), projects, t.getCreatedAt());
    }
}
