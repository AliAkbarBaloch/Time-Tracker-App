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
}
