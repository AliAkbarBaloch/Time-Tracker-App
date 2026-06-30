package com.timetracker.service;

import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.TimerAlreadyRunningException;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock UserRepository userRepository;
    @InjectMocks TaskService taskService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setPasswordHash("hash");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
    }

    @Test
    void startTask_noActiveTask_createsAndReturnsTask() {
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setStartTime(Instant.now());
            return t;
        });

        TaskResponse resp = taskService.startTask("alice@example.com", new StartTaskRequest("Study"));

        assertThat(resp.running()).isTrue();
        assertThat(resp.endTime()).isNull();
        verify(taskRepository).save(any(Task.class));
    }

    @Test
    void startTask_withNullRequest_createsTaskWithNullDescription() {
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.startTask("alice@example.com", null);
        assertThat(resp.description()).isNull();
    }

    @Test
    void startTask_activeTaskExists_throwsTimerAlreadyRunningException() {
        Task running = new Task();
        running.setUser(user);
        running.setStartTime(Instant.now());
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.of(running));

        assertThatThrownBy(() -> taskService.startTask("alice@example.com", null))
                .isInstanceOf(TimerAlreadyRunningException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void getActiveTask_running_returnsPresentOptional() {
        Task running = new Task();
        running.setUser(user);
        running.setStartTime(Instant.now());
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.of(running));

        Optional<TaskResponse> result = taskService.getActiveTask("alice@example.com");

        assertThat(result).isPresent();
        assertThat(result.get().running()).isTrue();
    }

    @Test
    void getActiveTask_noRunningTask_returnsEmpty() {
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());

        Optional<TaskResponse> result = taskService.getActiveTask("alice@example.com");

        assertThat(result).isEmpty();
    }
}
