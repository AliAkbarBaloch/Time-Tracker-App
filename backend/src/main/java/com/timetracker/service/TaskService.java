package com.timetracker.service;

import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.PageResponse;
import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.task.UpdateTaskRequest;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.InvalidTimeRangeException;
import com.timetracker.exception.NoActiveTimerException;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.exception.TaskNotFoundException;
import com.timetracker.exception.TimerAlreadyRunningException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import com.timetracker.specification.TaskSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;

    public TaskService(TaskRepository taskRepository,
                       UserRepository userRepository,
                       ProjectRepository projectRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional
    public TaskResponse startTask(String userEmail, StartTaskRequest request) {
        return startTask(userEmail, request, List.of());
    }

    @Transactional
    public TaskResponse startTask(String userEmail, StartTaskRequest request, List<Long> projectIds) {
        return startTask(userEmail, request, projectIds, 0L);
    }

    @Transactional
    public TaskResponse startTask(String userEmail, StartTaskRequest request, List<Long> projectIds, long totalPreviousSeconds) {
        User user = loadUser(userEmail);

        taskRepository.findByUserAndEndTimeIsNull(user).ifPresent(running -> {
            throw new TimerAlreadyRunningException();
        });

        Set<Project> projects = new HashSet<>();
        for (Long pid : projectIds) {
            Project p = projectRepository.findByIdAndMember(pid, user)
                    .orElseThrow(() -> new ProjectNotFoundException(pid));
            projects.add(p);
        }

        Task task = new Task();
        task.setUser(user);
        task.setStartTime(Instant.now());
        task.setDescription(request != null ? request.description() : null);
        task.setProjects(projects);
        task.setTotalPreviousSeconds(totalPreviousSeconds);

        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse stopTask(String userEmail) {
        User user = loadUser(userEmail);
        Task running = taskRepository.findByUserAndEndTimeIsNull(user)
                .orElseThrow(NoActiveTimerException::new);
        running.setEndTime(Instant.now());
        return TaskResponse.from(taskRepository.save(running));
    }

    @Transactional
    public TaskResponse createTask(String userEmail, CreateTaskRequest request) {
        if (!request.startTime().isBefore(request.endTime())) {
            throw new InvalidTimeRangeException("Start time must be before end time.");
        }

        User user = loadUser(userEmail);

        Set<Project> projects = new HashSet<>();
        if (request.projectIds() != null) {
            for (Long pid : request.projectIds()) {
                // Allow members of shared projects to associate tasks, not just owners
                Project p = projectRepository.findByIdAndMember(pid, user)
                        .orElseThrow(() -> new ProjectNotFoundException(pid));
                projects.add(p);
            }
        }

        Task task = new Task();
        task.setUser(user);
        task.setDescription(request.description());
        task.setStartTime(request.startTime());
        task.setEndTime(request.endTime());
        task.setProjects(projects);

        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse updateTask(String userEmail, Long taskId, UpdateTaskRequest request) {
        if (!request.startTime().isBefore(request.endTime())) {
            throw new InvalidTimeRangeException("Start time must be before end time.");
        }

        User user = loadUser(userEmail);
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new TaskNotFoundException(taskId));

        if (!task.getUser().equals(user)) {
            throw new org.springframework.security.access.AccessDeniedException("Not your task.");
        }

        Set<Project> projects = new HashSet<>();
        if (request.projectIds() != null) {
            for (Long pid : request.projectIds()) {
                // Allow members of shared projects to reassign tasks too
                Project p = projectRepository.findByIdAndMember(pid, user)
                        .orElseThrow(() -> new ProjectNotFoundException(pid));
                projects.add(p);
            }
        }

        task.setDescription(request.description());
        task.setStartTime(request.startTime());
        task.setEndTime(request.endTime());
        task.setProjects(projects);

        return TaskResponse.from(taskRepository.save(task));
    }

    public List<TaskResponse> listTasks(String userEmail) {
        User user = loadUser(userEmail);
        return taskRepository.findByUserOrderByStartTimeDesc(user).stream()
                .map(TaskResponse::from)
                .toList();
    }

    public List<TaskResponse> listTasks(String userEmail, Instant from, Instant to) {
        return listTasks(userEmail, from, to, null, null, null);
    }

    /** Delegates to the 6-param version with no userId filter for backward compatibility. */
    public List<TaskResponse> listTasks(String userEmail, Instant from, Instant to,
                                        String search, Long projectId) {
        return listTasks(userEmail, from, to, search, projectId, null);
    }

    /**
     * Full-featured list with optional date range, keyword search, project filter,
     * and — when combined with projectId — a per-user filter (US-023).
     *
     * When userId is provided:
     *  - projectId must also be provided (caller must be a project member)
     *  - the target user (userId) must also be a project member; otherwise 403
     *  - returns tasks belonging to userId rather than the caller
     */
    public List<TaskResponse> listTasks(String userEmail, Instant from, Instant to,
                                        String search, Long projectId, Long userId) {
        User caller = loadUser(userEmail);
        User taskOwner = caller;  // whose tasks to fetch; defaults to the caller
        Project filterProject = null;

        // Load and validate project membership for the caller when projectId is given
        if (projectId != null) {
            filterProject = projectRepository.findByIdAndMember(projectId, caller)
                    .orElseThrow(() -> new ProjectNotFoundException(projectId));
        }

        // userId filter: validate both caller and target are project members (US-023)
        if (userId != null) {
            if (filterProject == null) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "userId filter requires projectId to be specified.");
            }
            // Verify the target user exists and is a member of the same project
            User targetUser = userRepository.findById(userId)
                    .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                            "User is not a member of this project."));
            projectRepository.findByIdAndMember(projectId, targetUser)
                    .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                            "User is not a member of this project."));
            taskOwner = targetUser;
        }

        List<Task> tasks;
        if (from != null && to != null) {
            tasks = new ArrayList<>(taskRepository
                    .findByUserAndStartTimeBetweenOrderByStartTimeAsc(taskOwner, from, to));
        } else if (from != null) {
            tasks = new ArrayList<>(taskRepository
                    .findByUserAndStartTimeGreaterThanEqualOrderByStartTimeAsc(taskOwner, from));
        } else if (to != null) {
            tasks = new ArrayList<>(taskRepository
                    .findByUserAndStartTimeLessThanEqualOrderByStartTimeAsc(taskOwner, to));
        } else {
            tasks = new ArrayList<>(taskRepository.findByUserOrderByStartTimeDesc(taskOwner));
        }

        if (search != null && !search.isBlank()) {
            String lower = search.toLowerCase();
            tasks = tasks.stream()
                    .filter(t -> t.getDescription() != null
                            && t.getDescription().toLowerCase().contains(lower))
                    .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        }

        if (filterProject != null) {
            Set<Long> subtreeIds = collectSubtreeProjectIds(filterProject);
            tasks = tasks.stream()
                    .filter(t -> t.getProjects().stream()
                            .anyMatch(p -> subtreeIds.contains(p.getId())))
                    .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        }

        return tasks.stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<TaskResponse> listTasksPaged(String userEmail, Instant from, Instant to,
                                                      String search, Long projectId, Long userId,
                                                      int page, int size) {
        User caller = loadUser(userEmail);
        User taskOwner = caller;
        Set<Long> projectSubtreeIds = null;

        if (projectId != null) {
            Project filterProject = projectRepository.findByIdAndMember(projectId, caller)
                    .orElseThrow(() -> new ProjectNotFoundException(projectId));
            projectSubtreeIds = collectSubtreeProjectIds(filterProject);
        }

        if (userId != null) {
            if (projectId == null) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "userId filter requires projectId to be specified.");
            }
            User targetUser = userRepository.findById(userId)
                    .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                            "User is not a member of this project."));
            projectRepository.findByIdAndMember(projectId, targetUser)
                    .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                            "User is not a member of this project."));
            taskOwner = targetUser;
        }

        int clampedSize = Math.max(1, Math.min(size, 100));

        Specification<Task> spec = Specification.where(TaskSpecifications.ownedBy(taskOwner));
        if (from != null)                        spec = spec.and(TaskSpecifications.startedAtOrAfter(from));
        if (to != null)                          spec = spec.and(TaskSpecifications.startedBefore(to));
        if (search != null && !search.isBlank()) spec = spec.and(TaskSpecifications.descriptionContains(search));
        if (projectSubtreeIds != null)           spec = spec.and(TaskSpecifications.inProjects(projectSubtreeIds));

        // Two-query approach: count first to compute a valid page range, then fetch.
        // This preserves the original behaviour of clamping out-of-range pages to the last page
        // rather than returning empty content.
        long total = taskRepository.count(spec);
        int totalPages = total == 0 ? 1 : (int) Math.ceil((double) total / clampedSize);
        int clampedPage = Math.max(0, Math.min(page, totalPages - 1));

        Pageable pageable = PageRequest.of(clampedPage, clampedSize,
                Sort.by(Sort.Direction.DESC, "startTime"));
        Page<Task> dbPage = taskRepository.findAll(spec, pageable);

        return new PageResponse<>(
                dbPage.getContent().stream().map(TaskResponse::from).toList(),
                (int) total,
                totalPages,
                clampedPage,
                clampedSize
        );
    }

    private Set<Long> collectSubtreeProjectIds(Project project) {
        Set<Long> ids = new HashSet<>();
        ids.add(project.getId());
        for (Project sub : project.getSubprojects()) {
            ids.addAll(collectSubtreeProjectIds(sub));
        }
        return ids;
    }

    public Optional<TaskResponse> getActiveTask(String userEmail) {
        User user = loadUser(userEmail);
        return taskRepository.findByUserAndEndTimeIsNull(user)
                .map(TaskResponse::from);
    }

    @Transactional
    public void deleteTask(String userEmail, Long taskId) {
        User user = loadUser(userEmail);
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new TaskNotFoundException(taskId));
        if (!task.getUser().equals(user)) {
            throw new org.springframework.security.access.AccessDeniedException("Not your task.");
        }
        task.getProjects().clear();
        taskRepository.delete(task);
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
