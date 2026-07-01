package com.timetracker.dto.analytics;

import java.util.List;

public record WeeklyPatternResponse(int weeks, List<DayOfWeekEntry> byDayOfWeek) {
    public record DayOfWeekEntry(String day, double avgSeconds) {}
}
