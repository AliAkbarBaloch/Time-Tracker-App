package com.timetracker.dto.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateTemplateRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 500) String description,
    List<Long> projectIds
) {}
