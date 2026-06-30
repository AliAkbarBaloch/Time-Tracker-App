package com.timetracker.dto.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProjectRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 500) String description
) {}
