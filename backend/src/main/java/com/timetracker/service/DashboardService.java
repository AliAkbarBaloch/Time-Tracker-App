package com.timetracker.service;

import com.timetracker.dto.dashboard.DashboardSummaryResponse;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class DashboardService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public DashboardService(TaskRepository taskRepository,
                            ProjectRepository projectRepository,
                            UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

        ZonedDateTime now       = ZonedDateTime.now(ZoneOffset.UTC);
        Instant todayStart      = now.withHour(0).withMinute(0).withSecond(0).withNano(0).toInstant();
        Instant todayEnd        = todayStart.plusSeconds(86400);
        int dow = now.getDayOfWeek().getValue(); // 1=Mon … 7=Sun
        Instant weekStart       = now.minusDays(dow - 1L).withHour(0).withMinute(0).withSecond(0).withNano(0).toInstant();
        Instant weekEnd         = weekStart.plusSeconds(7L * 86400);

        // Running task
        TaskResponse runningTask = taskRepository.findByUserAndEndTimeIsNull(user)
                .map(TaskResponse::from).orElse(null);

        // Today's seconds (completed tasks only)
        List<Task> todayTasks = taskRepository
                .findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, todayStart, todayEnd);
        long todaySeconds = todayTasks.stream()
                .filter(t -> t.getEndTime() != null)
                .mapToLong(t -> t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond())
                .sum();

        // Week's seconds — deduplicate shared tasks
        List<Task> weekTasks = taskRepository
                .findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, weekStart, weekEnd);
        Set<Long> weekSeen = new HashSet<>();
        long weekSeconds = 0;
        for (Task t : weekTasks) {
            if (t.getEndTime() != null && weekSeen.add(t.getId())) {
                weekSeconds += t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond();
            }
        }

        // Top projects by time this week (root projects only, recursive subtree)
        List<Project> rootProjects = projectRepository.findByUserAndParentIsNull(user);
        List<DashboardSummaryResponse.TopProject> topProjects = rootProjects.stream()
                .map(p -> {
                    Set<Long> seen = new HashSet<>();
                    long secs = calcSubtreeSeconds(p, weekTasks, seen);
                    return new DashboardSummaryResponse.TopProject(p.getId(), p.getName(), secs);
                })
                .filter(tp -> tp.weekSeconds() > 0)
                .sorted(Comparator.comparingLong(DashboardSummaryResponse.TopProject::weekSeconds).reversed())
                .limit(5)
                .toList();

        return new DashboardSummaryResponse(todaySeconds, weekSeconds, runningTask, topProjects);
    }

    private long calcSubtreeSeconds(Project project, List<Task> weekTasks, Set<Long> seen) {
        Set<Long> subtreeIds = collectSubtreeProjectIds(project);
        long total = weekTasks.stream()
                .filter(t -> t.getEndTime() != null
                        && t.getProjects().stream().anyMatch(p -> subtreeIds.contains(p.getId()))
                        && seen.add(t.getId()))
                .mapToLong(t -> t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond())
                .sum();
        return total;
    }

    private Set<Long> collectSubtreeProjectIds(Project project) {
        Set<Long> ids = new HashSet<>();
        ids.add(project.getId());
        for (Project sub : project.getSubprojects()) {
            ids.addAll(collectSubtreeProjectIds(sub));
        }
        return ids;
    }
}
