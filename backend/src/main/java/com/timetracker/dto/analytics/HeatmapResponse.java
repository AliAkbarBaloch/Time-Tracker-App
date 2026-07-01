package com.timetracker.dto.analytics;

import java.util.List;

public record HeatmapResponse(int year, List<DayEntry> days) {
    public record DayEntry(String date, long totalSeconds) {}
}
