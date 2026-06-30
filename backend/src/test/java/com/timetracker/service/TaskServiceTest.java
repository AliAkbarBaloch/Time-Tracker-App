package com.timetracker.service;

import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.task.UpdateTaskRequest;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.InvalidTimeRangeException;
import com.timetracker.exception.NoActiveTimerException;
import com.timetracker.exception.TaskNotFoundException;
import com.timetracker.exception.TimerAlreadyRunningException;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock UserRepository userRepository;
    @Mock ProjectRepository projectRepository;
    @InjectMocks TaskService taskService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setPasswordHash("hash");
        lenient().when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
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

    @Test
    void stopTask_runningTask_setsEndTimeAndReturnsTask() {
        Task running = new Task();
        running.setUser(user);
        running.setStartTime(Instant.now().minusSeconds(60));
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.of(running));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.stopTask("alice@example.com");

        assertThat(resp.running()).isFalse();
        assertThat(resp.endTime()).isNotNull();
        verify(taskRepository).save(running);
    }

    @Test
    void stopTask_noRunningTask_throwsNoActiveTimerException() {
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.stopTask("alice@example.com"))
                .isInstanceOf(NoActiveTimerException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void createTask_validTimes_savesAndReturnsTask() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.createTask("alice@example.com",
                new CreateTaskRequest("Meeting", start, end, null));

        assertThat(resp.startTime()).isEqualTo(start);
        assertThat(resp.endTime()).isEqualTo(end);
        assertThat(resp.running()).isFalse();
        verify(taskRepository).save(any(Task.class));
    }

    @Test
    void createTask_startAfterEnd_throwsInvalidTimeRangeException() {
        Instant start = Instant.now();
        Instant end   = Instant.now().minusSeconds(60);

        assertThatThrownBy(() -> taskService.createTask("alice@example.com",
                new CreateTaskRequest("Bad", start, end, null)))
                .isInstanceOf(InvalidTimeRangeException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void createTask_startEqualsEnd_throwsInvalidTimeRangeException() {
        Instant t = Instant.now().minusSeconds(60);

        assertThatThrownBy(() -> taskService.createTask("alice@example.com",
                new CreateTaskRequest("Bad", t, t, null)))
                .isInstanceOf(InvalidTimeRangeException.class);
    }

    @Test
    void listTasks_returnsSortedTasks() {
        Instant t1 = Instant.now().minusSeconds(7200);
        Instant t2 = Instant.now().minusSeconds(3600);
        Task a = new Task(); a.setUser(user); a.setStartTime(t2); a.setEndTime(t2.plusSeconds(60));
        Task b = new Task(); b.setUser(user); b.setStartTime(t1); b.setEndTime(t1.plusSeconds(60));
        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(a, b));

        List<TaskResponse> result = taskService.listTasks("alice@example.com");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).startTime()).isEqualTo(t2);
    }

    @Test
    void updateTask_validRequest_updatesAndReturns() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        Task task = new Task();
        task.setUser(user);
        task.setStartTime(start);
        task.setEndTime(end);
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("Updated", start, end, null));

        assertThat(resp.description()).isEqualTo("Updated");
        verify(taskRepository).save(task);
    }

    @Test
    void updateTask_taskNotFound_throwsTaskNotFoundException() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.updateTask("alice@example.com", 99L,
                new UpdateTaskRequest("X", start, end, null)))
                .isInstanceOf(TaskNotFoundException.class);
    }

    @Test
    void updateTask_startAfterEnd_throwsInvalidTimeRangeException() {
        Instant start = Instant.now();
        Instant end   = start.minusSeconds(60);

        assertThatThrownBy(() -> taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("X", start, end, null)))
                .isInstanceOf(InvalidTimeRangeException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void updateTask_wrongOwner_throwsAccessDeniedException() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        User other = new User();
        other.setEmail("other@example.com");
        Task task = new Task();
        task.setUser(other);
        task.setStartTime(start);
        task.setEndTime(end);
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));

        assertThatThrownBy(() -> taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("X", start, end, null)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void deleteTask_validOwner_deletesTask() {
        Task task = new Task();
        task.setUser(user);
        task.setStartTime(Instant.now().minusSeconds(3600));
        task.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));

        taskService.deleteTask("alice@example.com", 1L);

        verify(taskRepository).delete(task);
    }

    @Test
    void deleteTask_taskNotFound_throwsTaskNotFoundException() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.deleteTask("alice@example.com", 99L))
                .isInstanceOf(TaskNotFoundException.class);
        verify(taskRepository, never()).delete(any());
    }

    @Test
    void deleteTask_wrongOwner_throwsAccessDeniedException() {
        User other = new User();
        other.setEmail("other@example.com");
        Task task = new Task();
        task.setUser(other);
        task.setStartTime(Instant.now().minusSeconds(3600));
        task.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));

        assertThatThrownBy(() -> taskService.deleteTask("alice@example.com", 1L))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(taskRepository, never()).delete(any());
    }
}
