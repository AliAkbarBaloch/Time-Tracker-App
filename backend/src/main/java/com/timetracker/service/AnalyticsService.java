package com.timetracker.service;

import com.timetracker.dto.analytics.HeatmapResponse;
import com.timetracker.dto.analytics.HeatmapResponse.DayEntry;
import com.timetracker.dto.analytics.SharedBreakdownResponse;
import com.timetracker.dto.analytics.WeeklyPatternResponse;
import com.timetracker.dto.analytics.WeeklyPatternResponse.DayOfWeekEntry;
import com.timetracker.entity.Project;
import com.timetracker.entity.ProjectMember;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.repository.ProjectMemberRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnalyticsService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public AnalyticsService(TaskRepository taskRepository,
                            UserRepository userRepository,
                            ProjectMemberRepository projectMemberRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    /**
     * Returns one entry per day with tracked time > 0 in the given year.
     * Day boundaries use the user's preferred timezone (US-025).
     */
    public HeatmapResponse getHeatmap(String userEmail, int year) {
        User user = loadUser(userEmail);
        ZoneId zone = ZoneId.of(user.getTimezone());

        Instant from = ZonedDateTime.of(year, 1, 1, 0, 0, 0, 0, zone).toInstant();
        Instant to   = ZonedDateTime.of(year + 1, 1, 1, 0, 0, 0, 0, zone).toInstant();

        List<Task> tasks = taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, from, to);

        Map<LocalDate, Long> byDate = new LinkedHashMap<>();
        for (Task task : tasks) {
            if (task.getEndTime() == null) continue;
            long seconds = task.getEndTime().getEpochSecond() - task.getStartTime().getEpochSecond();
            if (seconds <= 0) continue;
            LocalDate date = task.getStartTime().atZone(zone).toLocalDate();
            byDate.merge(date, seconds, Long::sum);
        }

        List<DayEntry> days = byDate.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new DayEntry(e.getKey().toString(), e.getValue()))
                .toList();

        return new HeatmapResponse(year, days);
    }

    /**
     * Returns average tracked seconds per day of week (MON–SUN) over the last N weeks
     * of the given year. The window ends at min(now, end-of-year) so current year ends
     * today, past years end at Dec 31, and future years produce an empty range (from > to)
     * which returns all-zero results naturally.
     */
    public WeeklyPatternResponse getWeeklyPattern(String userEmail, int weeks, int year) {
        User user = loadUser(userEmail);
        ZoneId zone = ZoneId.of(user.getTimezone());

        Instant now       = Instant.now();
        Instant yearStart = ZonedDateTime.of(year, 1, 1, 0, 0, 0, 0, zone).toInstant();
        Instant yearEnd   = ZonedDateTime.of(year + 1, 1, 1, 0, 0, 0, 0, zone).toInstant();
        Instant to        = now.isBefore(yearEnd) ? now : yearEnd;
        Instant from      = yearStart.isAfter(to)
                ? yearStart
                : to.minus((long) weeks * 7, ChronoUnit.DAYS);

        List<Task> tasks = taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, from, to);

        Map<DayOfWeek, Long> totalByDow = new EnumMap<>(DayOfWeek.class);
        for (DayOfWeek d : DayOfWeek.values()) totalByDow.put(d, 0L);

        for (Task task : tasks) {
            if (task.getEndTime() == null) continue;
            long seconds = task.getEndTime().getEpochSecond() - task.getStartTime().getEpochSecond();
            if (seconds <= 0) continue;
            DayOfWeek dow = task.getStartTime().atZone(zone).getDayOfWeek();
            totalByDow.merge(dow, seconds, Long::sum);
        }

        DayOfWeek[] ordered  = {DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                                 DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY};
        String[]   dayNames  = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};

        List<DayOfWeekEntry> byDayOfWeek = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            long total = totalByDow.get(ordered[i]);
            double avg = weeks > 0 ? (double) total / weeks : 0.0;
            byDayOfWeek.add(new DayOfWeekEntry(dayNames[i], avg));
        }

        return new WeeklyPatternResponse(weeks, byDayOfWeek);
    }

    /**
     * For each project that the user shares with at least one other member, returns
     * per-member contribution totals and percentages over the last {@code weeks} weeks
     * of {@code year}. Projects with zero activity in the window are omitted.
     */
    public SharedBreakdownResponse getSharedBreakdown(String userEmail, int weeks, int year) {
        User user = loadUser(userEmail);
        ZoneId zone = ZoneId.of(user.getTimezone());

        Instant now       = Instant.now();
        Instant yearEnd   = ZonedDateTime.of(year + 1, 1, 1, 0, 0, 0, 0, zone).toInstant();
        Instant yearStart = ZonedDateTime.of(year, 1, 1, 0, 0, 0, 0, zone).toInstant();
        Instant to        = now.isBefore(yearEnd) ? now : yearEnd;
        Instant from      = yearStart.isAfter(to)
                ? yearStart
                : to.minus((long) weeks * 7, ChronoUnit.DAYS);

        List<ProjectMember> memberships = projectMemberRepository.findByUser(user);

        List<SharedBreakdownResponse.ProjectContribution> result = new ArrayList<>();

        for (ProjectMember membership : memberships) {
            Project project = membership.getProject();

            List<ProjectMember> allMembers = projectMemberRepository.findByProject(project);
            if (allMembers.size() <= 1) continue;

            List<Task> tasks = taskRepository.findByProjectInTimeRange(project, from, to);

            Map<User, Long> byUser = new LinkedHashMap<>();
            for (Task task : tasks) {
                long secs = task.getEndTime().getEpochSecond() - task.getStartTime().getEpochSecond();
                if (secs <= 0) continue;
                byUser.merge(task.getUser(), secs, Long::sum);
            }

            long total = byUser.values().stream().mapToLong(Long::longValue).sum();
            if (total == 0) continue;

            List<SharedBreakdownResponse.UserContribution> contributions = byUser.entrySet().stream()
                    .sorted(Map.Entry.<User, Long>comparingByValue().reversed())
                    .map(e -> new SharedBreakdownResponse.UserContribution(
                            e.getKey().getDisplayName(),
                            e.getValue(),
                            (double) e.getValue() * 100.0 / total))
                    .toList();

            result.add(new SharedBreakdownResponse.ProjectContribution(
                    project.getId(), project.getName(), contributions));
        }

        return new SharedBreakdownResponse(weeks, result);
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
