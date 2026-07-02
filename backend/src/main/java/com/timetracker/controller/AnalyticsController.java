package com.timetracker.controller;

import com.timetracker.dto.analytics.HeatmapResponse;
import com.timetracker.dto.analytics.WeeklyPatternResponse;
import com.timetracker.service.AnalyticsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/heatmap")
    public HeatmapResponse getHeatmap(@AuthenticationPrincipal UserDetails principal,
                                      @RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        return analyticsService.getHeatmap(principal.getUsername(), y);
    }

    @GetMapping("/weekly-pattern")
    public WeeklyPatternResponse getWeeklyPattern(@AuthenticationPrincipal UserDetails principal,
                                                  @RequestParam(defaultValue = "12") int weeks,
                                                  @RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        return analyticsService.getWeeklyPattern(principal.getUsername(), weeks, y);
    }
}
