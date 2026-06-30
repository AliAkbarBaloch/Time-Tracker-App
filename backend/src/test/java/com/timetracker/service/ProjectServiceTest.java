package com.timetracker.service;

import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.ProjectResponse;
import com.timetracker.entity.Project;
import com.timetracker.entity.User;
import com.timetracker.exception.ProjectNameAlreadyExistsException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock ProjectRepository projectRepository;
    @Mock UserRepository userRepository;
    @InjectMocks ProjectService projectService;

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
    void createProject_uniqueName_returnsProjectResponse() {
        when(projectRepository.findByUser(user)).thenReturn(List.of());
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> {
            Project p = inv.getArgument(0);
            return p;
        });

        ProjectResponse resp = projectService.createProject("alice@example.com",
                new CreateProjectRequest("My Project", "A description"));

        assertThat(resp.name()).isEqualTo("My Project");
        assertThat(resp.description()).isEqualTo("A description");
        verify(projectRepository).save(any(Project.class));
    }

    @Test
    void createProject_duplicateName_throwsProjectNameAlreadyExistsException() {
        Project existing = new Project();
        existing.setName("My Project");
        when(projectRepository.findByUser(user)).thenReturn(List.of(existing));

        assertThatThrownBy(() -> projectService.createProject("alice@example.com",
                new CreateProjectRequest("My Project", null)))
                .isInstanceOf(ProjectNameAlreadyExistsException.class);
        verify(projectRepository, never()).save(any());
    }

    @Test
    void createProject_duplicateNameCaseInsensitive_throwsException() {
        Project existing = new Project();
        existing.setName("my project");
        when(projectRepository.findByUser(user)).thenReturn(List.of(existing));

        assertThatThrownBy(() -> projectService.createProject("alice@example.com",
                new CreateProjectRequest("MY PROJECT", null)))
                .isInstanceOf(ProjectNameAlreadyExistsException.class);
    }

    @Test
    void createProject_nullDescription_createsProjectWithNullDescription() {
        when(projectRepository.findByUser(user)).thenReturn(List.of());
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse resp = projectService.createProject("alice@example.com",
                new CreateProjectRequest("No Desc", null));

        assertThat(resp.description()).isNull();
    }

    @Test
    void listProjects_returnsUserProjects() {
        Project p1 = new Project(); p1.setName("Alpha"); p1.setUser(user);
        Project p2 = new Project(); p2.setName("Beta");  p2.setUser(user);
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of(p1, p2));

        List<ProjectResponse> result = projectService.listProjects("alice@example.com");

        assertThat(result).hasSize(2);
        assertThat(result).extracting(ProjectResponse::name).containsExactly("Alpha", "Beta");
    }

    @Test
    void listProjects_noProjects_returnsEmptyList() {
        when(projectRepository.findByUserAndParentIsNull(user)).thenReturn(List.of());

        List<ProjectResponse> result = projectService.listProjects("alice@example.com");

        assertThat(result).isEmpty();
    }
}
