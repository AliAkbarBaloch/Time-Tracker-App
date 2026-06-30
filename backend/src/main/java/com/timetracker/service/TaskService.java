package com.timetracker.service;

import com.timetracker.dto.task.CreateTaskRequest;
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
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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
        User user = loadUser(userEmail);

        taskRepository.findByUserAndEndTimeIsNull(user).ifPresent(running -> {
            throw new TimerAlreadyRunningException();
        });

        Task task = new Task();
        task.setUser(user);
        task.setStartTime(Instant.now());
        task.setDescription(request != null ? request.description() : null);

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
                Project p = projectRepository.findByIdAndUser(pid, user)
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
                Project p = projectRepository.findByIdAndUser(pid, user)
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
        User user = loadUser(userEmail);
        if (from != null && to != null) {
            return taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, from, to)
                    .stream().map(TaskResponse::from).toList();
        }
        return taskRepository.findByUserOrderByStartTimeDesc(user).stream()
                .map(TaskResponse::from).toList();
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
