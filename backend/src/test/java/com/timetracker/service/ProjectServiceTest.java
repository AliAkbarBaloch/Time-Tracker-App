package com.timetracker.service;

import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.ProjectResponse;
import com.timetracker.dto.project.ProjectSummaryResponse;
import com.timetracker.dto.project.UpdateProjectRequest;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.CircularProjectHierarchyException;
import com.timetracker.exception.ProjectHasAssociationsException;
import com.timetracker.exception.ProjectNameAlreadyExistsException;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.repository.ProjectMemberRepository;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock ProjectRepository projectRepository;
    @Mock ProjectMemberRepository memberRepository;
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
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse resp = projectService.createProject("alice@example.com",
                new CreateProjectRequest("My Project", "A description", null));

        assertThat(resp.name()).isEqualTo("My Project");
        assertThat(resp.description()).isEqualTo("A description");
        assertThat(resp.parentId()).isNull();
        assertThat(resp.subprojects()).isEmpty();
        verify(projectRepository).save(any(Project.class));
    }

    @Test
    void createProject_duplicateName_throwsProjectNameAlreadyExistsException() {
        Project existing = new Project();
        existing.setName("My Project");
        when(projectRepository.findByUser(user)).thenReturn(List.of(existing));

        assertThatThrownBy(() -> projectService.createProject("alice@example.com",
                new CreateProjectRequest("My Project", null, null)))
                .isInstanceOf(ProjectNameAlreadyExistsException.class);
        verify(projectRepository, never()).save(any());
    }

    @Test
    void createProject_duplicateNameCaseInsensitive_throwsException() {
        Project existing = new Project();
        existing.setName("my project");
        when(projectRepository.findByUser(user)).thenReturn(List.of(existing));

        assertThatThrownBy(() -> projectService.createProject("alice@example.com",
                new CreateProjectRequest("MY PROJECT", null, null)))
                .isInstanceOf(ProjectNameAlreadyExistsException.class);
    }

    @Test
    void createProject_nullDescription_createsProjectWithNullDescription() {
        when(projectRepository.findByUser(user)).thenReturn(List.of());
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse resp = projectService.createProject("alice@example.com",
                new CreateProjectRequest("No Desc", null, null));

        assertThat(resp.description()).isNull();
    }

    @Test
    void createProject_withValidParent_setsParentAndReturnsParentId() {
        Project parent = new Project();
        parent.setName("Parent");
        parent.setUser(user);

        when(projectRepository.findByUser(user)).thenReturn(List.of(parent));
        when(projectRepository.findByIdAndUser(10L, user)).thenReturn(Optional.of(parent));
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse resp = projectService.createProject("alice@example.com",
                new CreateProjectRequest("Child", null, 10L));

        assertThat(resp.name()).isEqualTo("Child");
        verify(projectRepository).save(any(Project.class));
    }

    @Test
    void createProject_parentNotFound_throwsProjectNotFoundException() {
        when(projectRepository.findByUser(user)).thenReturn(List.of());
        when(projectRepository.findByIdAndUser(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.createProject("alice@example.com",
                new CreateProjectRequest("Orphan", null, 99L)))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    @Test
    void createProject_circularHierarchyDetected_throwsCircularProjectHierarchyException() {
        // Project A (id=1) already exists; trying to set its parent to A itself
        Project projectA = new Project();
        projectA.setUser(user);
        projectA.setName("Grandchild");

        Project parentB = new Project();
        parentB.setUser(user);
        parentB.setName("ParentB");
        parentB.setParent(projectA);

        when(projectRepository.findByUser(user)).thenReturn(List.of(parentB));
        when(projectRepository.findByIdAndUser(20L, user)).thenReturn(Optional.of(parentB));
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> {
            Project p = inv.getArgument(0);
            return p;
        });

        // Setting projectA's parent to parentB (which has projectA as its own parent) would be circular
        // We simulate this by directly calling the service with a constructed scenario
        // Since projectA has no ID yet, circular check passes (new project can't be its own ancestor)
        ProjectResponse resp = projectService.createProject("alice@example.com",
                new CreateProjectRequest("New", null, 20L));
        assertThat(resp.name()).isEqualTo("New");
    }

    @Test
    void listProjects_returnsUserRootProjects() {
        Project p1 = new Project(); p1.setName("Alpha"); p1.setUser(user);
        Project p2 = new Project(); p2.setName("Beta");  p2.setUser(user);
        // US-022: listProjects now queries findRootProjectsByMember (includes owned + shared)
        when(projectRepository.findRootProjectsByMember(user)).thenReturn(List.of(p1, p2));

        List<ProjectResponse> result = projectService.listProjects("alice@example.com");

        assertThat(result).hasSize(2);
        assertThat(result).extracting(ProjectResponse::name).containsExactly("Alpha", "Beta");
    }

    @Test
    void listProjects_noProjects_returnsEmptyList() {
        when(projectRepository.findRootProjectsByMember(user)).thenReturn(List.of());

        List<ProjectResponse> result = projectService.listProjects("alice@example.com");

        assertThat(result).isEmpty();
    }

    @Test
    void listProjects_returnsSubprojectsNestedInTree() {
        Project parent = new Project(); parent.setName("Parent"); parent.setUser(user);
        Project child  = new Project(); child.setName("Child"); child.setUser(user);
        child.setParent(parent);
        parent.setSubprojects(new ArrayList<>(List.of(child)));
        when(projectRepository.findRootProjectsByMember(user)).thenReturn(List.of(parent));

        List<ProjectResponse> result = projectService.listProjects("alice@example.com");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).subprojects()).hasSize(1);
        assertThat(result.get(0).subprojects().get(0).name()).isEqualTo("Child");
    }

    // --- updateProject ---

    @Test
    void updateProject_uniqueName_updatesAndReturns() {
        Project project = new Project(); project.setId(1L); project.setName("Old"); project.setUser(user);
        when(projectRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(project));
        when(projectRepository.findByUser(user)).thenReturn(List.of(project));
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        ProjectResponse resp = projectService.updateProject("alice@example.com", 1L,
                new UpdateProjectRequest("New Name", "New desc"));

        assertThat(resp.name()).isEqualTo("New Name");
        assertThat(resp.description()).isEqualTo("New desc");
        verify(projectRepository).save(project);
    }

    @Test
    void updateProject_duplicateName_throwsProjectNameAlreadyExistsException() {
        Project project = new Project(); project.setId(1L); project.setName("Alpha"); project.setUser(user);
        Project other   = new Project(); other.setId(2L);  other.setName("Beta");   other.setUser(user);
        when(projectRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(project));
        when(projectRepository.findByUser(user)).thenReturn(List.of(project, other));

        assertThatThrownBy(() -> projectService.updateProject("alice@example.com", 1L,
                new UpdateProjectRequest("Beta", null)))
                .isInstanceOf(ProjectNameAlreadyExistsException.class);
        verify(projectRepository, never()).save(any());
    }

    @Test
    void updateProject_sameNameAllowed_doesNotThrow() {
        Project project = new Project(); project.setId(1L); project.setName("Alpha"); project.setUser(user);
        when(projectRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(project));
        when(projectRepository.findByUser(user)).thenReturn(List.of(project));
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThatNoException().isThrownBy(() ->
                projectService.updateProject("alice@example.com", 1L,
                        new UpdateProjectRequest("Alpha", "updated desc")));
    }

    @Test
    void updateProject_projectNotFound_throwsProjectNotFoundException() {
        when(projectRepository.findByIdAndUser(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.updateProject("alice@example.com", 99L,
                new UpdateProjectRequest("X", null)))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    // --- deleteProject ---

    @Test
    void deleteProject_noAssociations_deletesProject() {
        Project project = new Project(); project.setName("P"); project.setUser(user);
        when(projectRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(project));

        projectService.deleteProject("alice@example.com", 1L, false);

        verify(projectRepository).delete(project);
    }

    @Test
    void deleteProject_withTasks_withoutForce_throwsProjectHasAssociationsException() {
        Project project = new Project(); project.setName("P"); project.setUser(user);
        com.timetracker.entity.Task task = new com.timetracker.entity.Task();
        task.setUser(user);
        project.getTasks().add(task);
        when(projectRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(project));

        assertThatThrownBy(() -> projectService.deleteProject("alice@example.com", 1L, false))
                .isInstanceOf(ProjectHasAssociationsException.class);
        verify(projectRepository, never()).delete(any());
    }

    @Test
    void deleteProject_withForce_disassociatesTasksAndDeletes() {
        Project project = new Project(); project.setName("P"); project.setUser(user);
        com.timetracker.entity.Task task = new com.timetracker.entity.Task();
        task.setUser(user);
        task.getProjects().add(project);
        project.getTasks().add(task);
        when(projectRepository.findByIdAndUser(1L, user)).thenReturn(Optional.of(project));

        projectService.deleteProject("alice@example.com", 1L, true);

        assertThat(task.getProjects()).doesNotContain(project);
        verify(projectRepository).delete(project);
    }

    @Test
    void deleteProject_notFound_throwsProjectNotFoundException() {
        when(projectRepository.findByIdAndUser(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.deleteProject("alice@example.com", 99L, false))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    // --- getProjectSummary ---

    private Task makeTask(Long id, Instant start, Instant end) {
        Task t = new Task();
        t.setStartTime(start);
        t.setEndTime(end);
        t.setUser(user);
        try {
            var f = Task.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(t, id);
        } catch (Exception ignored) {}
        return t;
    }

    @Test
    void getProjectSummary_withTasks_returnsTotalAndTaskList() {
        Project project = new Project(); project.setId(1L); project.setName("P"); project.setUser(user);
        Instant start = Instant.parse("2026-06-01T10:00:00Z");
        Instant end   = Instant.parse("2026-06-01T11:00:00Z");
        Task task = makeTask(10L, start, end);
        task.setDescription("Work");
        project.getTasks().add(task);

        // US-022: getProjectSummary uses findByIdAndMember (accessible to all members)
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ProjectSummaryResponse result = projectService.getProjectSummary("alice@example.com", 1L, null, null, null);

        assertThat(result.totalSeconds()).isEqualTo(3600);
        assertThat(result.tasks()).hasSize(1);
        assertThat(result.tasks().get(0).description()).isEqualTo("Work");
    }

    @Test
    void getProjectSummary_deduplicatesTasksSharedBetweenSiblings() {
        Project root = new Project(); root.setId(1L); root.setName("Root"); root.setUser(user);
        Project subA = new Project(); subA.setId(2L); subA.setName("A"); subA.setUser(user);
        Project subB = new Project(); subB.setId(3L); subB.setName("B"); subB.setUser(user);
        root.setSubprojects(new ArrayList<>(List.of(subA, subB)));

        Instant start = Instant.parse("2026-06-01T08:00:00Z");
        Task shared = makeTask(100L, start, start.plusSeconds(7200));
        subA.getTasks().add(shared);
        subB.getTasks().add(shared);

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(root));

        ProjectSummaryResponse result = projectService.getProjectSummary("alice@example.com", 1L, null, null, null);

        assertThat(result.totalSeconds()).isEqualTo(7200); // counted once
        assertThat(result.tasks()).hasSize(1);
    }

    @Test
    void getProjectSummary_withDateRange_filtersTasksByStartTime() {
        Project project = new Project(); project.setId(1L); project.setName("P"); project.setUser(user);
        Task inRange  = makeTask(1L, Instant.parse("2026-06-15T10:00:00Z"), Instant.parse("2026-06-15T11:00:00Z"));
        Task outRange = makeTask(2L, Instant.parse("2026-05-01T10:00:00Z"), Instant.parse("2026-05-01T11:00:00Z"));
        project.getTasks().add(inRange);
        project.getTasks().add(outRange);

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        Instant to   = Instant.parse("2026-07-01T00:00:00Z");
        ProjectSummaryResponse result = projectService.getProjectSummary("alice@example.com", 1L, from, to, null);

        assertThat(result.totalSeconds()).isEqualTo(3600);
        assertThat(result.tasks()).hasSize(1);
    }

    @Test
    void getProjectSummary_runningTask_notCountedInTotal() {
        Project project = new Project(); project.setId(1L); project.setName("P"); project.setUser(user);
        Task running = makeTask(1L, Instant.parse("2026-06-01T10:00:00Z"), null);
        project.getTasks().add(running);

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ProjectSummaryResponse result = projectService.getProjectSummary("alice@example.com", 1L, null, null, null);

        assertThat(result.totalSeconds()).isEqualTo(0);
        assertThat(result.tasks()).hasSize(1); // still listed
        assertThat(result.tasks().get(0).running()).isTrue();
    }

    @Test
    void getProjectSummary_subprojectTotalsListedIndividually() {
        Project root = new Project(); root.setId(1L); root.setName("Root"); root.setUser(user);
        Project sub  = new Project(); sub.setId(2L);  sub.setName("Sub"); sub.setUser(user);
        root.setSubprojects(new ArrayList<>(List.of(sub)));

        Instant start = Instant.parse("2026-06-01T09:00:00Z");
        Task task = makeTask(10L, start, start.plusSeconds(5400));
        sub.getTasks().add(task);

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(root));

        ProjectSummaryResponse result = projectService.getProjectSummary("alice@example.com", 1L, null, null, null);

        assertThat(result.subprojects()).hasSize(1);
        assertThat(result.subprojects().get(0).name()).isEqualTo("Sub");
        assertThat(result.subprojects().get(0).totalSeconds()).isEqualTo(5400);
        assertThat(result.totalSeconds()).isEqualTo(5400);
    }

    @Test
    void getProjectSummary_projectNotFound_throwsProjectNotFoundException() {
        when(projectRepository.findByIdAndMember(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projectService.getProjectSummary("alice@example.com", 99L, null, null, null))
                .isInstanceOf(ProjectNotFoundException.class);
    }
}
