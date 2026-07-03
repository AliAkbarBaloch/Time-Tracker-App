package com.timetracker.service;

import com.timetracker.dto.dashboard.DashboardSummaryResponse;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.mockito.ArgumentCaptor;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock ProjectRepository projectRepository;
    @Mock UserRepository userRepository;
    @InjectMocks DashboardService dashboardService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("bob@example.com");
        user.setDisplayName("Bob");
        user.setPasswordHash("hash");
        lenient().when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));
    }

    private Task completedTask(long startEpoch, long endEpoch) {
        Task t = new Task();
        t.setUser(user);
        t.setStartTime(Instant.ofEpochSecond(startEpoch));
        t.setEndTime(Instant.ofEpochSecond(endEpoch));
        t.setProjects(new HashSet<>());
        return t;
    }

    private Task runningTask() {
        Task t = new Task();
        t.setUser(user);
        t.setDescription("running");
        t.setStartTime(Instant.now().minusSeconds(60));
        t.setEndTime(null);
        t.setProjects(new HashSet<>());
        return t;
    }

    @Test
    void getSummary_noTasks_returnsZeros() {
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(Collections.emptyList());

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.todaySeconds()).isZero();
        assertThat(result.weekSeconds()).isZero();
        assertThat(result.runningTask()).isNull();
        assertThat(result.topProjects()).isEmpty();
    }

    @Test
    void getSummary_runningTaskIsReturned() {
        Task running = runningTask();
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.of(running));
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(Collections.emptyList());

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.runningTask()).isNotNull();
        assertThat(result.runningTask().description()).isEqualTo("running");
    }

    @Test
    void getSummary_completedTodayTaskCountedInTodayAndWeek() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long startEpoch = now.withHour(9).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();
        long endEpoch   = startEpoch + 3600; // 1 hour
        Task task = completedTask(startEpoch, endEpoch);

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        // first call = today range, second call = week range
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(task));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(Collections.emptyList());

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.todaySeconds()).isEqualTo(3600);
        assertThat(result.weekSeconds()).isEqualTo(3600);
    }

    @Test
    void getSummary_runningTaskNotCountedInSeconds() {
        Task running = runningTask();
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.of(running));
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(running));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(Collections.emptyList());

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.todaySeconds()).isZero();
        assertThat(result.weekSeconds()).isZero();
    }

    @Test
    void getSummary_topProjectsSortedDescByWeekSeconds() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long baseEpoch = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project p1 = new Project();
        p1.setId(1L); p1.setName("Small"); p1.setUser(user); p1.setSubprojects(new ArrayList<>());
        Project p2 = new Project();
        p2.setId(2L); p2.setName("Large"); p2.setUser(user); p2.setSubprojects(new ArrayList<>());

        Task t1 = completedTask(baseEpoch, baseEpoch + 600);   // 10min → p1
        t1.setProjects(new HashSet<>(List.of(p1)));
        Task t2 = completedTask(baseEpoch, baseEpoch + 3600);  // 60min → p2
        t2.setProjects(new HashSet<>(List.of(p2)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t1, t2));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p1, p2));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(2);
        assertThat(result.topProjects().get(0).name()).isEqualTo("Large");
        assertThat(result.topProjects().get(0).weekSeconds()).isEqualTo(3600);
        assertThat(result.topProjects().get(1).name()).isEqualTo("Small");
        assertThat(result.topProjects().get(1).weekSeconds()).isEqualTo(600);
    }

    @Test
    void getSummary_topProjectsLimitedToFive() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        List<Project> projects = new ArrayList<>();
        List<Task> tasks = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            Project p = new Project();
            p.setId((long) i); p.setName("P" + i); p.setUser(user); p.setSubprojects(new ArrayList<>());
            projects.add(p);
            Task t = completedTask(base, base + i * 60L);
            t.setProjects(new HashSet<>(List.of(p)));
            tasks.add(t);
        }

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(tasks);
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(projects);

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(5);
    }

    @Test
    void getSummary_projectWithZeroWeekTimeExcluded() {
        Project p = new Project();
        p.setId(1L); p.setName("Idle"); p.setUser(user); p.setSubprojects(new ArrayList<>());

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).isEmpty();
    }

    @Test
    void getSummary_subtaskTimeCountedToParentProject() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project parent = new Project();
        parent.setId(10L); parent.setName("Parent"); parent.setUser(user);

        Project child = new Project();
        child.setId(11L); child.setName("Child"); child.setUser(user); child.setSubprojects(new ArrayList<>());
        parent.setSubprojects(new ArrayList<>(List.of(child)));

        Task t = completedTask(base, base + 1800); // 30min on child project
        t.setProjects(new HashSet<>(List.of(child)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(parent));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(1);
        assertThat(result.topProjects().get(0).name()).isEqualTo("Parent");
        assertThat(result.topProjects().get(0).weekSeconds()).isEqualTo(1800);
    }

    @Test
    void getSummary_userNotFound_throwsException() {
        when(userRepository.findByEmail("unknown@example.com"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> dashboardService.getSummary("unknown@example.com"))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }

    @Test
    void getSummary_weekStartIsMonday() {
        // Kills L47: dow+1 mutation — weekStart must be a Monday at midnight UTC
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(Collections.emptyList());
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(Collections.emptyList());

        dashboardService.getSummary("bob@example.com");

        ArgumentCaptor<Instant> fromCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> toCaptor   = ArgumentCaptor.forClass(Instant.class);
        verify(taskRepository, times(2)).findByUserAndStartTimeBetweenOrderByStartTimeAsc(
                eq(user), fromCaptor.capture(), toCaptor.capture());

        // Second call is the week range; 'from' must be Monday at 00:00 UTC
        ZonedDateTime weekFrom = fromCaptor.getAllValues().get(1).atZone(ZoneOffset.UTC);
        assertThat(weekFrom.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(weekFrom.getHour()).isZero();
        assertThat(weekFrom.getMinute()).isZero();
        assertThat(weekFrom.getSecond()).isZero();
    }

    @Test
    void getSummary_projectWithBudget_computesUsedHoursAndPercent() {
        // Kills L83/L84 (conditional mutations) and L117/L119 (calcSubtreeTotalSeconds)
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project p = new Project();
        p.setId(1L); p.setName("Budget"); p.setUser(user);
        p.setSubprojects(new ArrayList<>());
        p.setBudgetHours(4.0);

        Task t = completedTask(base, base + 7200); // 2 hours = 7200s
        t.setProjects(new HashSet<>(List.of(p)));
        p.setTasks(new HashSet<>(Set.of(t)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(1);
        DashboardSummaryResponse.TopProject tp = result.topProjects().get(0);
        assertThat(tp.usedHours()).isEqualTo(2.0);      // 7200 / 3600; mutation: returns 0 or negates
        assertThat(tp.budgetPercent()).isEqualTo(50.0);  // 2.0 / 4.0 * 100; mutation: returns null
    }

    // ── budgetHours == 0 → budgetPercent null (L87) ───────────────────────────

    @Test
    void getSummary_projectWithBudgetHoursZero_budgetPercentIsNull() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project p = new Project();
        p.setId(1L); p.setName("ZeroBudget"); p.setUser(user);
        p.setSubprojects(new ArrayList<>());
        p.setBudgetHours(0.0); // budgetHours <= 0 → budgetPercent must be null

        Task t = completedTask(base, base + 3600);
        t.setProjects(new HashSet<>(List.of(p)));
        p.setTasks(new HashSet<>(Set.of(t)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(1);
        assertThat(result.topProjects().get(0).budgetPercent()).isNull();
    }

    // ── calcSubtreeSeconds: endTime == null → task skipped in week total ──────

    @Test
    void getSummary_weekTaskWithNullEndTime_notCountedInWeekSeconds() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project p = new Project();
        p.setId(1L); p.setName("P"); p.setUser(user);
        p.setSubprojects(new ArrayList<>());

        // Running task (endTime null) — associated to the project
        Task running = new Task();
        running.setUser(user);
        running.setStartTime(Instant.ofEpochSecond(base));
        running.setEndTime(null);
        running.setProjects(new HashSet<>(List.of(p)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.of(running));
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(running));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        // Running task must not be counted in weekSeconds for the project
        assertThat(result.topProjects()).isEmpty(); // weekSeconds == 0 → filtered out
        assertThat(result.weekSeconds()).isEqualTo(0);
    }

    // ── calcSubtreeSeconds: duplicate task in seen set → counted only once ────

    @Test
    void getSummary_duplicateTaskAcrossSubprojects_countedOnce() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project parent = new Project();
        parent.setId(10L); parent.setName("Parent"); parent.setUser(user);

        Project child1 = new Project();
        child1.setId(11L); child1.setName("Child1"); child1.setUser(user);
        child1.setSubprojects(new ArrayList<>());

        Project child2 = new Project();
        child2.setId(12L); child2.setName("Child2"); child2.setUser(user);
        child2.setSubprojects(new ArrayList<>());

        parent.setSubprojects(new ArrayList<>(List.of(child1, child2)));

        // Same task shared across both children — must be counted only once
        Task shared = completedTask(base, base + 3600);
        try {
            var f = Task.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(shared, 99L);
        } catch (Exception ignored) {}
        shared.setProjects(new HashSet<>(List.of(child1, child2)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(shared));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(parent));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(1);
        assertThat(result.topProjects().get(0).weekSeconds()).isEqualTo(3600); // not 7200
    }

    // ── calcSubtreeTotalSeconds: endTime null → task not counted in all-time ──

    @Test
    void getSummary_allTimeRunningTask_notCountedInBudgetProgress() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project p = new Project();
        p.setId(1L); p.setName("BudgetProject"); p.setUser(user);
        p.setSubprojects(new ArrayList<>());
        p.setBudgetHours(10.0);

        // Completed task for week (week count)
        Task weekTask = completedTask(base, base + 3600);
        weekTask.setProjects(new HashSet<>(List.of(p)));

        // Running task (endTime null) directly on the project — must not be counted
        Task running = new Task();
        running.setUser(user);
        running.setStartTime(Instant.ofEpochSecond(base + 100));
        running.setEndTime(null);
        try {
            var f = Task.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(running, 55L);
        } catch (Exception ignored) {}
        running.setProjects(new HashSet<>(List.of(p)));
        p.setTasks(new HashSet<>(Set.of(weekTask, running)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(weekTask));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(1);
        // usedHours must reflect only the completed task (3600s = 1h), not the running one
        assertThat(result.topProjects().get(0).usedHours()).isEqualTo(1.0);
    }

    // ── calcSubtreeTotalSeconds: duplicate task already in seen → counted once ─

    @Test
    void getSummary_allTimeDuplicateTask_countedOnce() {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        long base = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().getEpochSecond();

        Project parent = new Project();
        parent.setId(20L); parent.setName("Root"); parent.setUser(user);

        Project child = new Project();
        child.setId(21L); child.setName("Child"); child.setUser(user);
        child.setSubprojects(new ArrayList<>());
        parent.setSubprojects(new ArrayList<>(List.of(child)));
        parent.setBudgetHours(5.0);

        // Task appears in both parent.tasks and child.tasks — seen set must deduplicate
        Task t = completedTask(base, base + 7200);
        try {
            var f = Task.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(t, 77L);
        } catch (Exception ignored) {}
        t.setProjects(new HashSet<>(List.of(parent, child)));
        parent.setTasks(new HashSet<>(Set.of(t)));
        child.setTasks(new HashSet<>(Set.of(t)));

        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(eq(user), any(), any()))
                .thenReturn(List.of(t));
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(parent));

        DashboardSummaryResponse result = dashboardService.getSummary("bob@example.com");

        assertThat(result.topProjects()).hasSize(1);
        // 7200s = 2h, counted once
        assertThat(result.topProjects().get(0).usedHours()).isEqualTo(2.0);
    }
}
