package com.timetracker.dto.task;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

public record UpdateTaskRequest(
        String description,
        @NotNull(message = "Start time is required") Instant startTime,
        @NotNull(message = "End time is required")   Instant endTime,
        List<Long> projectIds
) {}
