package com.timetracker.service;

import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.task.UpdateTaskRequest;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.entity.Project;
import com.timetracker.exception.InvalidTimeRangeException;
import com.timetracker.exception.NoActiveTimerException;
import com.timetracker.exception.ProjectNotFoundException;
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

import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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

    // --- project association ---

    @Test
    void createTask_withProjectIds_associatesProjectsAndReturnsThemInResponse() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        Project project = new Project();
        project.setId(10L);
        project.setName("Thesis");
        project.setUser(user);

        // US-022: createTask now uses findByIdAndMember (allows members of shared projects)
        when(projectRepository.findByIdAndMember(10L, user)).thenReturn(Optional.of(project));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.createTask("alice@example.com",
                new CreateTaskRequest("Work", start, end, List.of(10L)));

        assertThat(resp.projects()).hasSize(1);
        assertThat(resp.projects().get(0).id()).isEqualTo(10L);
        assertThat(resp.projects().get(0).name()).isEqualTo("Thesis");
    }

    @Test
    void createTask_withInvalidProjectId_throwsProjectNotFoundException() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        when(projectRepository.findByIdAndMember(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.createTask("alice@example.com",
                new CreateTaskRequest("Work", start, end, List.of(99L))))
                .isInstanceOf(ProjectNotFoundException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void createTask_withNullProjectIds_returnsEmptyProjectList() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.createTask("alice@example.com",
                new CreateTaskRequest("Work", start, end, null));

        assertThat(resp.projects()).isEmpty();
    }

    @Test
    void updateTask_withProjectIds_replacesProjectAssociations() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        Project project = new Project();
        project.setId(20L);
        project.setName("Work");
        project.setUser(user);

        Task task = new Task();
        task.setUser(user);
        task.setStartTime(start);
        task.setEndTime(end);

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        // US-022: updateTask now uses findByIdAndMember (allows members of shared projects)
        when(projectRepository.findByIdAndMember(20L, user)).thenReturn(Optional.of(project));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("Updated", start, end, List.of(20L)));

        assertThat(resp.projects()).hasSize(1);
        assertThat(resp.projects().get(0).name()).isEqualTo("Work");
    }

    @Test
    void updateTask_withInvalidProjectId_throwsProjectNotFoundException() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        Task task = new Task();
        task.setUser(user);
        task.setStartTime(start);
        task.setEndTime(end);

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(projectRepository.findByIdAndMember(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("X", start, end, List.of(99L))))
                .isInstanceOf(ProjectNotFoundException.class);
        verify(taskRepository, never()).save(any());
    }

    @Test
    void updateTask_clearProjects_returnsEmptyProjectList() {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        Project project = new Project();
        project.setId(30L);
        project.setName("Old");
        project.setUser(user);

        Task task = new Task();
        task.setUser(user);
        task.setStartTime(start);
        task.setEndTime(end);
        task.getProjects().add(project);

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("Updated", start, end, null));

        assertThat(resp.projects()).isEmpty();
    }

    // --- listTasks with date range ---

    @Test
    void listTasks_withFromAndTo_returnsFilteredTasks() {
        Instant from = Instant.now().minusSeconds(86400);
        Instant to   = Instant.now().plusSeconds(86400);

        Task t = new Task(); t.setUser(user);
        t.setStartTime(Instant.now().minusSeconds(3600));
        t.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, from, to))
                .thenReturn(List.of(t));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", from, to);

        assertThat(result).hasSize(1);
        verify(taskRepository).findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, from, to);
        verify(taskRepository, never()).findByUserOrderByStartTimeDesc(any());
    }

    @Test
    void listTasks_withNullRange_returnsAllTasks() {
        Task t = new Task(); t.setUser(user);
        t.setStartTime(Instant.now().minusSeconds(3600));
        t.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(t));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null);

        assertThat(result).hasSize(1);
        verify(taskRepository).findByUserOrderByStartTimeDesc(user);
        verify(taskRepository, never()).findByUserAndStartTimeBetweenOrderByStartTimeAsc(any(), any(), any());
    }

    @Test
    void listTasks_withFromAndTo_noMatchingTasks_returnsEmpty() {
        Instant from = Instant.now().minusSeconds(86400);
        Instant to   = Instant.now().plusSeconds(86400);
        when(taskRepository.findByUserAndStartTimeBetweenOrderByStartTimeAsc(user, from, to))
                .thenReturn(List.of());

        List<TaskResponse> result = taskService.listTasks("alice@example.com", from, to);

        assertThat(result).isEmpty();
    }

    @Test
    void listTasks_withFromOnly_callsGreaterThanEqualQuery() {
        Instant from = Instant.now().minusSeconds(86400);
        Task t = new Task(); t.setUser(user);
        t.setStartTime(Instant.now().minusSeconds(3600));
        t.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findByUserAndStartTimeGreaterThanEqualOrderByStartTimeAsc(user, from))
                .thenReturn(List.of(t));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", from, null);

        assertThat(result).hasSize(1);
        verify(taskRepository).findByUserAndStartTimeGreaterThanEqualOrderByStartTimeAsc(user, from);
        verify(taskRepository, never()).findByUserOrderByStartTimeDesc(any());
        verify(taskRepository, never()).findByUserAndStartTimeBetweenOrderByStartTimeAsc(any(), any(), any());
    }

    @Test
    void listTasks_withToOnly_callsLessThanEqualQuery() {
        Instant to = Instant.now();
        Task t = new Task(); t.setUser(user);
        t.setStartTime(Instant.now().minusSeconds(3600));
        t.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findByUserAndStartTimeLessThanEqualOrderByStartTimeAsc(user, to))
                .thenReturn(List.of(t));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, to);

        assertThat(result).hasSize(1);
        verify(taskRepository).findByUserAndStartTimeLessThanEqualOrderByStartTimeAsc(user, to);
        verify(taskRepository, never()).findByUserOrderByStartTimeDesc(any());
        verify(taskRepository, never()).findByUserAndStartTimeBetweenOrderByStartTimeAsc(any(), any(), any());
    }

    // --- listTasks with search keyword ---

    @Test
    void listTasks_searchKeyword_returnsOnlyMatching() {
        Task match = new Task(); match.setUser(user); match.setDescription("Read research paper");
        match.setStartTime(Instant.now().minusSeconds(3600)); match.setEndTime(Instant.now().minusSeconds(1800));
        Task noMatch = new Task(); noMatch.setUser(user); noMatch.setDescription("Write code");
        noMatch.setStartTime(Instant.now().minusSeconds(7200)); noMatch.setEndTime(Instant.now().minusSeconds(5400));

        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(match, noMatch));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, "research", null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).description()).isEqualTo("Read research paper");
    }

    @Test
    void listTasks_searchKeyword_caseInsensitive() {
        Task t = new Task(); t.setUser(user); t.setDescription("Read Research Paper");
        t.setStartTime(Instant.now().minusSeconds(3600)); t.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(t));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, "RESEARCH", null);

        assertThat(result).hasSize(1);
    }

    @Test
    void listTasks_searchKeyword_noMatch_returnsEmpty() {
        Task t = new Task(); t.setUser(user); t.setDescription("Write code");
        t.setStartTime(Instant.now().minusSeconds(3600)); t.setEndTime(Instant.now().minusSeconds(1800));
        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(t));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, "nonexistent", null);

        assertThat(result).isEmpty();
    }

    // --- listTasks with projectId filter ---

    @Test
    void listTasks_projectIdFilter_returnsOnlyProjectTasks() {
        Project project = new Project(); project.setId(10L); project.setUser(user); project.setName("Thesis");

        Task inProject = new Task(); inProject.setUser(user); inProject.setDescription("Thesis task");
        inProject.setStartTime(Instant.now().minusSeconds(3600));
        inProject.setEndTime(Instant.now().minusSeconds(1800));
        inProject.getProjects().add(project);

        Task notInProject = new Task(); notInProject.setUser(user); notInProject.setDescription("Other task");
        notInProject.setStartTime(Instant.now().minusSeconds(7200));
        notInProject.setEndTime(Instant.now().minusSeconds(5400));

        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(inProject, notInProject));
        // US-022: listTasks with projectId filter uses findByIdAndMember
        when(projectRepository.findByIdAndMember(10L, user)).thenReturn(Optional.of(project));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, null, 10L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).description()).isEqualTo("Thesis task");
    }

    @Test
    void listTasks_projectIdFilter_projectNotFound_throws() {
        // Project lookup happens before task fetch now, so no taskRepository stub needed
        when(projectRepository.findByIdAndMember(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                taskService.listTasks("alice@example.com", null, null, null, 99L))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    // ── mutation killers: ArgumentCaptor + boundary conditions ─────────────────

    @Test
    void startTask_capturesUserDescriptionAndProjects() {
        // Kills L65-68: removed setUser/setStartTime/setDescription/setProjects mutations
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        Project project = new Project();
        project.setId(5L); project.setName("Alpha"); project.setUser(user);
        when(projectRepository.findByIdAndMember(5L, user)).thenReturn(Optional.of(project));

        taskService.startTask("alice@example.com", new StartTaskRequest("research"), List.of(5L));

        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(user);
        assertThat(captor.getValue().getDescription()).isEqualTo("research");
        assertThat(captor.getValue().getStartTime()).isNotNull();
        assertThat(captor.getValue().getProjects()).containsExactly(project);
    }

    @Test
    void startTask_withAccumulatedSeconds_setsFieldOnTask() {
        // Kills removed setTotalPreviousSeconds mutation
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.startTask("alice@example.com", new StartTaskRequest("coding"), List.of(), 3600L);

        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalPreviousSeconds()).isEqualTo(3600L);
    }

    @Test
    void startTask_noAccumulatedSeconds_defaultsToZero() {
        when(taskRepository.findByUserAndEndTimeIsNull(user)).thenReturn(Optional.empty());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.startTask("alice@example.com", new StartTaskRequest("meeting"));

        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalPreviousSeconds()).isEqualTo(0L);
    }

    @Test
    void createTask_capturesUserAndDescription() {
        // Kills L101-102: removed setUser/setDescription mutations
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.createTask("alice@example.com",
                new CreateTaskRequest("deep work", start, end, null));

        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(user);
        assertThat(captor.getValue().getDescription()).isEqualTo("deep work");
    }

    @Test
    void updateTask_setsNewStartAndEndTime() {
        // Kills L135-136: removed setStartTime/setEndTime mutations
        Instant oldStart = Instant.now().minusSeconds(7200);
        Instant oldEnd   = Instant.now().minusSeconds(5400);
        Instant newStart = Instant.now().minusSeconds(3600);
        Instant newEnd   = Instant.now().minusSeconds(1800);

        Task task = new Task();
        task.setUser(user);
        task.setStartTime(oldStart);
        task.setEndTime(oldEnd);
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse resp = taskService.updateTask("alice@example.com", 1L,
                new UpdateTaskRequest("X", newStart, newEnd, null));

        assertThat(resp.startTime()).isEqualTo(newStart);
        assertThat(resp.endTime()).isEqualTo(newEnd);
    }

    @Test
    void deleteTask_clearsProjectsBeforeDelete() {
        // Kills L246: removed Set::clear mutation
        Project p = new Project(); p.setId(10L); p.setName("Work"); p.setUser(user);
        Task task = new Task();
        task.setUser(user);
        task.setStartTime(Instant.now().minusSeconds(3600));
        task.setEndTime(Instant.now().minusSeconds(1800));
        task.setProjects(new HashSet<>(Set.of(p)));
        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));

        taskService.deleteTask("alice@example.com", 1L);

        assertThat(task.getProjects()).isEmpty();
        verify(taskRepository).delete(task);
    }

    @Test
    void listTasks_projectFilter_excludesTaskFromDifferentProject() {
        // Kills L216: replaced-boolean-return-with-true mutation in anyMatch lambda
        Project filterProject = new Project();
        filterProject.setId(10L); filterProject.setUser(user); filterProject.setName("Thesis");
        Project otherProject = new Project();
        otherProject.setId(20L); otherProject.setUser(user); otherProject.setName("Other");

        Task inProject = new Task(); inProject.setUser(user); inProject.setDescription("Thesis task");
        inProject.setStartTime(Instant.now().minusSeconds(3600));
        inProject.setEndTime(Instant.now().minusSeconds(1800));
        inProject.setProjects(new HashSet<>(Set.of(filterProject)));

        Task inOtherProject = new Task(); inOtherProject.setUser(user); inOtherProject.setDescription("Other task");
        inOtherProject.setStartTime(Instant.now().minusSeconds(7200));
        inOtherProject.setEndTime(Instant.now().minusSeconds(5400));
        inOtherProject.setProjects(new HashSet<>(Set.of(otherProject))); // has project but wrong one

        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(inProject, inOtherProject));
        when(projectRepository.findByIdAndMember(10L, user)).thenReturn(Optional.of(filterProject));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, null, 10L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).description()).isEqualTo("Thesis task");
    }

    // ── search non-null/non-blank but description is null → excluded ──────────

    @Test
    void listTasks_searchKeyword_taskWithNullDescription_isExcluded() {
        // Covers L219: t.getDescription() != null — description == null branch
        Task nullDesc = new Task(); nullDesc.setUser(user); nullDesc.setDescription(null);
        nullDesc.setStartTime(Instant.now().minusSeconds(3600));
        nullDesc.setEndTime(Instant.now().minusSeconds(1800));

        Task withDesc = new Task(); withDesc.setUser(user); withDesc.setDescription("Research");
        withDesc.setStartTime(Instant.now().minusSeconds(7200));
        withDesc.setEndTime(Instant.now().minusSeconds(5400));

        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(nullDesc, withDesc));

        // search is non-null and non-blank → the description-null branch must be taken for nullDesc
        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, "Research", null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).description()).isEqualTo("Research");
    }

    @Test
    void listTasks_searchNonBlank_allDescriptionsNull_returnsEmpty() {
        // Covers L216 true-branch: search != null && !search.isBlank()
        // then L219 false-branch: description == null → excluded
        Task t1 = new Task(); t1.setUser(user); t1.setDescription(null);
        t1.setStartTime(Instant.now().minusSeconds(3600));
        t1.setEndTime(Instant.now().minusSeconds(1800));

        when(taskRepository.findByUserOrderByStartTimeDesc(user)).thenReturn(List.of(t1));

        List<TaskResponse> result = taskService.listTasks("alice@example.com", null, null, "anything", null);

        assertThat(result).isEmpty();
    }
}
