package com.timetracker.service;

import com.timetracker.dto.analytics.HeatmapResponse;
import com.timetracker.dto.analytics.WeeklyPatternResponse;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock UserRepository userRepository;
    @InjectMocks AnalyticsService analyticsService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setPasswordHash("hash");
        // UTC timezone so day boundaries are predictable in tests
        user.setTimezone("UTC");
        lenient().when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
    }

    private Task task(String startIso, String endIso) {
        Task t = new Task();
        t.setUser(user);
        t.setDescription("task");
        t.setStartTime(Instant.parse(startIso));
        t.setEndTime(Instant.parse(endIso));
        t.setProjects(new HashSet<>());
        return t;
    }

    private Task runningTask() {
        Task t = new Task();
        t.setUser(user);
        t.setStartTime(Instant.now().minusSeconds(60));
        t.setEndTime(null);
        t.setProjects(new HashSet<>());
        return t;
    }

    // ── getHeatmap ─────────────────────────────────────────────────────────────

    @Test
    void getHeatmap_noTasks_returnsEmptyDays() {
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.year()).isEqualTo(2026);
        assertThat(result.days()).isEmpty();
    }

    @Test
    void getHeatmap_singleTask_returnsCorrectDayAndSeconds() {
        // 2h task on 2026-03-10 UTC
        Task t = task("2026-03-10T08:00:00Z", "2026-03-10T10:00:00Z");
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.days()).hasSize(1);
        assertThat(result.days().get(0).date()).isEqualTo("2026-03-10");
        assertThat(result.days().get(0).totalSeconds()).isEqualTo(7200);
    }

    @Test
    void getHeatmap_multipleTasksSameDay_aggregatesSeconds() {
        Task t1 = task("2026-05-01T08:00:00Z", "2026-05-01T09:00:00Z"); // 3600s
        Task t2 = task("2026-05-01T10:00:00Z", "2026-05-01T11:30:00Z"); // 5400s
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t1, t2));

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.days()).hasSize(1);
        assertThat(result.days().get(0).totalSeconds()).isEqualTo(9000);
    }

    @Test
    void getHeatmap_multipleDays_returnsSortedAscending() {
        Task t1 = task("2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");
        Task t2 = task("2026-03-15T08:00:00Z", "2026-03-15T09:00:00Z");
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t1, t2));

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.days()).hasSize(2);
        assertThat(result.days().get(0).date()).isEqualTo("2026-03-15");
        assertThat(result.days().get(1).date()).isEqualTo("2026-06-01");
    }

    @Test
    void getHeatmap_runningTask_excluded() {
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(runningTask()));

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.days()).isEmpty();
    }

    @Test
    void getHeatmap_zeroSecondTask_excluded() {
        Task t = task("2026-04-01T08:00:00Z", "2026-04-01T08:00:00Z"); // same start and end
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.days()).isEmpty();
    }

    @Test
    void getHeatmap_userNotFound_throws() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> analyticsService.getHeatmap("nobody@example.com", 2026))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }

    @Test
    void getHeatmap_usesUserTimezone_dayBoundary() {
        // User in Berlin (UTC+1 in winter). A task starting at 23:30 UTC on Jan 1
        // is already Jan 2 in Berlin.
        user.setTimezone("Europe/Berlin");
        Task t = task("2026-01-01T23:30:00Z", "2026-01-02T00:30:00Z");
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));

        HeatmapResponse result = analyticsService.getHeatmap("alice@example.com", 2026);

        assertThat(result.days()).hasSize(1);
        // 23:30 UTC = 00:30 CET → Jan 2 in Berlin
        assertThat(result.days().get(0).date()).isEqualTo("2026-01-02");
    }

    // ── getWeeklyPattern ───────────────────────────────────────────────────────

    @Test
    void getWeeklyPattern_noTasks_returnsSevenZeroEntries() {
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 12);

        assertThat(result.weeks()).isEqualTo(12);
        assertThat(result.byDayOfWeek()).hasSize(7);
        assertThat(result.byDayOfWeek()).allMatch(e -> e.avgSeconds() == 0.0);
    }

    @Test
    void getWeeklyPattern_returnsDaysInMonToSunOrder() {
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 4);

        assertThat(result.byDayOfWeek().get(0).day()).isEqualTo("MON");
        assertThat(result.byDayOfWeek().get(6).day()).isEqualTo("SUN");
    }

    @Test
    void getWeeklyPattern_taskOnMonday_averagedOverWeeks() {
        // Use a fixed Monday within the last 1 week window
        Instant now = Instant.now();
        Instant mondayStart = now.minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
        Instant mondayEnd   = mondayStart.plusSeconds(3600);

        Task t = new Task();
        t.setUser(user);
        t.setStartTime(mondayStart);
        t.setEndTime(mondayEnd);
        t.setProjects(new HashSet<>());

        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 1);

        // 3600s total / 1 week = 3600 avg on that day of week
        double total = result.byDayOfWeek().stream().mapToDouble(e -> e.avgSeconds()).sum();
        assertThat(total).isEqualTo(3600.0);
    }

    @Test
    void getWeeklyPattern_runningTask_excluded() {
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(runningTask()));

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 1);

        assertThat(result.byDayOfWeek()).allMatch(e -> e.avgSeconds() == 0.0);
    }

    @Test
    void getWeeklyPattern_zeroWeeks_returnsZeroAverage() {
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 0);

        assertThat(result.byDayOfWeek()).allMatch(e -> e.avgSeconds() == 0.0);
    }

    @Test
    void getWeeklyPattern_userNotFound_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> analyticsService.getWeeklyPattern("ghost@example.com", 12))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }

    // ── range / arithmetic mutation killers ────────────────────────────────────

    @Test
    void getHeatmap_queriesFullYearRange() {
        // Kills L46: year+1 mutation — captures 'to' and asserts it equals Jan 1 of next year
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());

        analyticsService.getHeatmap("alice@example.com", 2026);

        ArgumentCaptor<Instant> fromCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> toCaptor   = ArgumentCaptor.forClass(Instant.class);
        verify(taskRepository).findByUserAndStartTimeBetweenOrderByStartTimeAsc(
                eq(user), fromCaptor.capture(), toCaptor.capture());

        ZoneId utc = ZoneId.of("UTC");
        assertThat(fromCaptor.getValue())
                .isEqualTo(ZonedDateTime.of(2026, 1, 1, 0, 0, 0, 0, utc).toInstant());
        assertThat(toCaptor.getValue())
                .isEqualTo(ZonedDateTime.of(2027, 1, 1, 0, 0, 0, 0, utc).toInstant());
    }

    @Test
    void getWeeklyPattern_queriesCorrectWeekRange() {
        // Kills L76: weeks*7 mutation — captures range and asserts diff equals weeks*7 days
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());

        analyticsService.getWeeklyPattern("alice@example.com", 4);

        ArgumentCaptor<Instant> fromCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> toCaptor   = ArgumentCaptor.forClass(Instant.class);
        verify(taskRepository).findByUserAndStartTimeBetweenOrderByStartTimeAsc(
                eq(user), fromCaptor.capture(), toCaptor.capture());

        long diffDays = ChronoUnit.DAYS.between(fromCaptor.getValue(), toCaptor.getValue());
        assertThat(diffDays).isEqualTo(28L); // 4 * 7; mutation weeks/7 → 0, weeks+7 → 11
    }

    @Test
    void getWeeklyPattern_negativeDurationTask_excluded() {
        // Kills L86 "removed conditional": task with end < start should contribute 0
        Task t = new Task();
        t.setUser(user);
        t.setStartTime(Instant.parse("2026-04-08T10:00:00Z"));
        t.setEndTime(Instant.parse("2026-04-08T08:00:00Z")); // end before start → negative seconds
        t.setProjects(new HashSet<>());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 1);

        assertThat(result.byDayOfWeek()).allMatch(e -> e.avgSeconds() == 0.0);
    }

    @Test
    void getWeeklyPattern_averageDividedByWeekCount() {
        // Kills L98: total*weeks mutation — 7200/2=3600 but 7200*2=14400
        Task t = task("2026-04-08T08:00:00Z", "2026-04-08T10:00:00Z"); // 7200s on Wednesday
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));

        WeeklyPatternResponse result = analyticsService.getWeeklyPattern("alice@example.com", 2);

        assertThat(result.byDayOfWeek().get(2).avgSeconds()).isEqualTo(3600.0); // index 2 = WED
    }
}
