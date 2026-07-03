package com.timetracker.dto.task;

import java.util.List;

public record PageResponse<T>(
        List<T> content,
        int totalElements,
        int totalPages,
        int currentPage,
        int pageSize
) {}
