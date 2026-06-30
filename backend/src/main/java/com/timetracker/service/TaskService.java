package com.timetracker.service;

import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.NoActiveTimerException;
import com.timetracker.exception.TimerAlreadyRunningException;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
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

    public Optional<TaskResponse> getActiveTask(String userEmail) {
        User user = loadUser(userEmail);
        return taskRepository.findByUserAndEndTimeIsNull(user)
                .map(TaskResponse::from);
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
