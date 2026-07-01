package com.timetracker.service;

import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.template.CreateTemplateRequest;
import com.timetracker.dto.template.TemplateResponse;
import com.timetracker.dto.template.UpdateTemplateRequest;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.TaskTemplate;
import com.timetracker.entity.User;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.exception.TemplateNotFoundException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskTemplateRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskTemplateServiceTest {

    @Mock TaskTemplateRepository templateRepository;
    @Mock UserRepository         userRepository;
    @Mock ProjectRepository      projectRepository;
    @Mock TaskService             taskService;
    @InjectMocks TaskTemplateService service;

    private User    user;
    private Project project;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setPasswordHash("hash");
        user.setTimezone("UTC");

        project = new Project();
        project.setId(10L);
        project.setName("Thesis");
        project.setUser(user);
        project.setSubprojects(new ArrayList<>());
        project.setTasks(new HashSet<>());

        lenient().when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
    }

    private TaskTemplate savedTemplate(String name, String description) {
        TaskTemplate t = new TaskTemplate();
        t.setUser(user);
        t.setName(name);
        t.setDescription(description);
        t.setProjects(new HashSet<>());
        return t;
    }

    // ── createTemplate ─────────────────────────────────────────────────────────

    @Test
    void createTemplate_noProjects_succeeds() {
        TaskTemplate saved = savedTemplate("Stand-Up", "Daily meeting");
        when(templateRepository.save(any())).thenReturn(saved);

        CreateTemplateRequest req = new CreateTemplateRequest("Stand-Up", "Daily meeting", null);
        TemplateResponse result = service.createTemplate("alice@example.com", req);

        assertThat(result.name()).isEqualTo("Stand-Up");
        assertThat(result.description()).isEqualTo("Daily meeting");
        assertThat(result.projects()).isEmpty();
        verify(templateRepository).save(any());
    }

    @Test
    void createTemplate_setsUserNameDescriptionProjects() {
        // Kills L48-51: removed-setter mutations for user/name/description/projects
        when(templateRepository.save(any(TaskTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        service.createTemplate("alice@example.com",
                new CreateTemplateRequest("Stand-Up", "Daily meeting", null));

        ArgumentCaptor<TaskTemplate> captor = ArgumentCaptor.forClass(TaskTemplate.class);
        verify(templateRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isEqualTo(user);
        assertThat(captor.getValue().getName()).isEqualTo("Stand-Up");
        assertThat(captor.getValue().getDescription()).isEqualTo("Daily meeting");
        assertThat(captor.getValue().getProjects()).isEmpty();
    }

    @Test
    void createTemplate_withProject_resolvesProject() {
        when(projectRepository.findByIdAndMember(10L, user)).thenReturn(Optional.of(project));
        TaskTemplate saved = savedTemplate("Work", null);
        saved.setProjects(Set.of(project));
        when(templateRepository.save(any())).thenReturn(saved);

        CreateTemplateRequest req = new CreateTemplateRequest("Work", null, List.of(10L));
        TemplateResponse result = service.createTemplate("alice@example.com", req);

        assertThat(result.projects()).hasSize(1);
        assertThat(result.projects().get(0).name()).isEqualTo("Thesis");
    }

    @Test
    void createTemplate_unknownProject_throwsProjectNotFound() {
        when(projectRepository.findByIdAndMember(99L, user)).thenReturn(Optional.empty());

        CreateTemplateRequest req = new CreateTemplateRequest("T", null, List.of(99L));
        assertThatThrownBy(() -> service.createTemplate("alice@example.com", req))
                .isInstanceOf(ProjectNotFoundException.class);

        verify(templateRepository, never()).save(any());
    }

    @Test
    void createTemplate_userNotFound_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createTemplate("ghost@example.com",
                new CreateTemplateRequest("T", null, null)))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }

    // ── listTemplates ──────────────────────────────────────────────────────────

    @Test
    void listTemplates_returnsOwnTemplatesOnly() {
        TaskTemplate t1 = savedTemplate("T1", null);
        TaskTemplate t2 = savedTemplate("T2", "desc");
        when(templateRepository.findByUserOrderByCreatedAtDesc(user)).thenReturn(List.of(t1, t2));

        List<TemplateResponse> result = service.listTemplates("alice@example.com");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).name()).isEqualTo("T1");
        assertThat(result.get(1).name()).isEqualTo("T2");
    }

    @Test
    void listTemplates_empty_returnsEmptyList() {
        when(templateRepository.findByUserOrderByCreatedAtDesc(user)).thenReturn(List.of());

        List<TemplateResponse> result = service.listTemplates("alice@example.com");

        assertThat(result).isEmpty();
    }

    // ── updateTemplate ─────────────────────────────────────────────────────────

    @Test
    void updateTemplate_updatesNameAndDescription() {
        TaskTemplate existing = savedTemplate("OldName", "old desc");
        when(templateRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(existing));
        when(templateRepository.save(any())).thenReturn(existing);

        UpdateTemplateRequest req = new UpdateTemplateRequest("NewName", "new desc", null);
        TemplateResponse result = service.updateTemplate("alice@example.com", 1L, req);

        assertThat(result.name()).isEqualTo("NewName");
        assertThat(result.description()).isEqualTo("new desc"); // kills L72: removed setDescription
        verify(templateRepository).save(existing);
    }

    @Test
    void updateTemplate_templateNotFound_throws() {
        when(templateRepository.findByIdAndUser(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateTemplate("alice@example.com", 99L,
                new UpdateTemplateRequest("X", null, null)))
                .isInstanceOf(TemplateNotFoundException.class);
    }

    @Test
    void updateTemplate_withNewProject_replacesProjects() {
        TaskTemplate existing = savedTemplate("T", null);
        when(templateRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(existing));
        when(projectRepository.findByIdAndMember(10L, user)).thenReturn(Optional.of(project));
        when(templateRepository.save(any())).thenReturn(existing);

        UpdateTemplateRequest req = new UpdateTemplateRequest("T", null, List.of(10L));
        service.updateTemplate("alice@example.com", 1L, req);

        assertThat(existing.getProjects()).containsExactly(project);
    }

    // ── deleteTemplate ─────────────────────────────────────────────────────────

    @Test
    void deleteTemplate_succeeds() {
        TaskTemplate existing = savedTemplate("T", null);
        when(templateRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(existing));

        service.deleteTemplate("alice@example.com", 1L);

        verify(templateRepository).delete(existing);
    }

    @Test
    void deleteTemplate_templateNotFound_throws() {
        when(templateRepository.findByIdAndUser(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteTemplate("alice@example.com", 99L))
                .isInstanceOf(TemplateNotFoundException.class);

        verify(templateRepository, never()).delete(any());
    }

    @Test
    void deleteTemplate_clearsProjectsBeforeDelete() {
        TaskTemplate existing = savedTemplate("T", null);
        existing.setProjects(new HashSet<>(Set.of(project)));
        when(templateRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(existing));

        service.deleteTemplate("alice@example.com", 1L);

        assertThat(existing.getProjects()).isEmpty();
        verify(templateRepository).delete(existing);
    }

    // ── startFromTemplate ──────────────────────────────────────────────────────

    @Test
    void startFromTemplate_callsTaskServiceWithDescriptionAndProjects() {
        TaskTemplate template = savedTemplate("Stand-Up", "Morning sync");
        template.setProjects(Set.of(project));
        when(templateRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(template));

        Task started = new Task();
        started.setDescription("Morning sync");
        started.setStartTime(Instant.now());
        started.setProjects(Set.of(project));
        TaskResponse mockResponse = TaskResponse.from(started);
        when(taskService.startTask(eq("alice@example.com"), any(StartTaskRequest.class), any()))
                .thenReturn(mockResponse);

        TaskResponse result = service.startFromTemplate("alice@example.com", 1L);

        assertThat(result).isNotNull(); // kills L97: returned null mutation
        verify(taskService).startTask(eq("alice@example.com"),
                argThat(r -> "Morning sync".equals(r.description())),
                argThat(ids -> ids.contains(10L)));
    }

    @Test
    void startFromTemplate_templateNotFound_throws() {
        when(templateRepository.findByIdAndUser(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.startFromTemplate("alice@example.com", 99L))
                .isInstanceOf(TemplateNotFoundException.class);

        verify(taskService, never()).startTask(any(), any(), any());
    }
}
