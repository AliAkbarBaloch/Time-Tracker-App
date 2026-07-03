package com.timetracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectExportServiceTest {

    @Mock ProjectRepository projectRepository;
    @Mock UserRepository    userRepository;
    @Spy  ObjectMapper      objectMapper = new ObjectMapper();
    @InjectMocks ProjectExportService exportService;

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
        project.setId(1L);
        project.setName("Thesis");
        project.setUser(user);
        project.setSubprojects(new ArrayList<>());
        project.setTasks(new HashSet<>());
        project.setMembers(new ArrayList<>());

        lenient().when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
    }

    private Task completedTask(long id, String description, String startIso, String endIso) {
        Task t = new Task();
        // set id via reflection isn't needed — Task.getId() is from DB;
        // for tests the id can be null since CSV uses t.getId() but we only care about content
        t.setDescription(description);
        t.setStartTime(Instant.parse(startIso));
        t.setEndTime(Instant.parse(endIso));
        t.setUser(user);
        t.setProjects(new HashSet<>(Set.of(project)));
        return t;
    }

    // ── CSV export ─────────────────────────────────────────────────────────────

    @Test
    void export_csv_returnsAttachmentHeader() {
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        assertThat(response.getHeaders().getFirst("Content-Disposition"))
                .contains("attachment")
                .contains("Thesis");
    }

    @Test
    void export_csv_containsHeaderRow() {
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        assertThat(response.getBody()).startsWith("task_id,description,start_time,end_time,duration_seconds,projects,user\n");
    }

    @Test
    void export_csv_containsTaskData() {
        Task t = completedTask(1L, "Write intro", "2026-03-10T08:00:00Z", "2026-03-10T10:00:00Z");
        project.setTasks(new HashSet<>(Set.of(t)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        assertThat(response.getBody()).contains("Write intro");
        assertThat(response.getBody()).contains("7200"); // 2h = 7200s
        assertThat(response.getBody()).contains("Alice");
    }

    @Test
    void export_csv_runningTask_durationIsZero() {
        Task running = new Task();
        running.setDescription("Running");
        running.setStartTime(Instant.parse("2026-03-10T08:00:00Z"));
        running.setEndTime(null);
        running.setUser(user);
        running.setProjects(new HashSet<>(Set.of(project)));
        project.setTasks(new HashSet<>(Set.of(running)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        // running task has duration 0, end_time empty
        assertThat(response.getBody()).contains(",0,");
    }

    @Test
    void export_csv_csvEscapesCommaInDescription() {
        Task t = completedTask(1L, "Study, review", "2026-03-10T08:00:00Z", "2026-03-10T10:00:00Z");
        project.setTasks(new HashSet<>(Set.of(t)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        // description with comma must be quoted
        assertThat(response.getBody()).contains("\"Study, review\"");
    }

    @Test
    void export_csv_csvEscapesQuoteInDescription() {
        Task t = completedTask(1L, "Say \"hello\"", "2026-03-10T08:00:00Z", "2026-03-10T10:00:00Z");
        project.setTasks(new HashSet<>(Set.of(t)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        assertThat(response.getBody()).contains("\"Say \"\"hello\"\"\"");
    }

    // ── JSON export ────────────────────────────────────────────────────────────

    @Test
    void export_json_returnsAttachmentHeader() {
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "json", null, null);

        assertThat(response.getHeaders().getFirst("Content-Disposition")).contains("attachment");
        assertThat(response.getHeaders().getFirst("Content-Disposition")).contains("Thesis");
    }

    @Test
    void export_json_containsTopLevelFields() throws Exception {
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "json", null, null);

        assertThat(response.getBody()).contains("\"project\"");
        assertThat(response.getBody()).contains("\"exportedAt\"");
        assertThat(response.getBody()).contains("\"tasks\"");
        assertThat(response.getBody()).contains("Thesis");
    }

    @Test
    void export_json_taskFieldsPresent() throws Exception {
        Task t = completedTask(1L, "Write intro", "2026-03-10T08:00:00Z", "2026-03-10T10:00:00Z");
        project.setTasks(new HashSet<>(Set.of(t)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "json", null, null);

        assertThat(response.getBody()).contains("\"description\"");
        assertThat(response.getBody()).contains("Write intro");
        assertThat(response.getBody()).contains("\"durationSeconds\"");
        assertThat(response.getBody()).contains("7200");
    }

    // ── Date range filtering ────────────────────────────────────────────────────

    @Test
    void export_withDateRange_excludesTasksOutsideRange() {
        Task inRange  = completedTask(1L, "InRange",  "2026-06-01T08:00:00Z", "2026-06-01T10:00:00Z");
        Task outRange = completedTask(2L, "OutRange", "2026-03-01T08:00:00Z", "2026-03-01T10:00:00Z");
        project.setTasks(new HashSet<>(Set.of(inRange, outRange)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        Instant to   = Instant.parse("2026-06-30T00:00:00Z");
        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", from, to);

        assertThat(response.getBody()).contains("InRange");
        assertThat(response.getBody()).doesNotContain("OutRange");
    }

    @Test
    void export_fromBoundaryExclusive_taskBeforeFromExcluded() {
        Task early = completedTask(1L, "Early", "2026-05-31T23:59:59Z", "2026-06-01T00:30:00Z");
        project.setTasks(new HashSet<>(Set.of(early)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", from, null);

        assertThat(response.getBody()).doesNotContain("Early");
    }

    // ── Subproject recursion ───────────────────────────────────────────────────

    @Test
    void export_includesSubprojectTasks() {
        Project sub = new Project();
        sub.setId(2L);
        sub.setName("Chapter 1");
        sub.setUser(user);
        sub.setSubprojects(new ArrayList<>());
        sub.setMembers(new ArrayList<>());

        Task subTask = new Task();
        subTask.setDescription("SubTask");
        subTask.setStartTime(Instant.parse("2026-04-01T08:00:00Z"));
        subTask.setEndTime(Instant.parse("2026-04-01T09:00:00Z"));
        subTask.setUser(user);
        subTask.setProjects(new HashSet<>(Set.of(sub)));
        sub.setTasks(new HashSet<>(Set.of(subTask)));
        project.setSubprojects(List.of(sub));

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        assertThat(response.getBody()).contains("SubTask");
    }

    @Test
    void export_deduplicatesTaskSharedAcrossSubprojects() {
        Project sub1 = new Project();
        sub1.setId(2L); sub1.setName("Sub1"); sub1.setUser(user);
        sub1.setSubprojects(new ArrayList<>()); sub1.setMembers(new ArrayList<>());

        Project sub2 = new Project();
        sub2.setId(3L); sub2.setName("Sub2"); sub2.setUser(user);
        sub2.setSubprojects(new ArrayList<>()); sub2.setMembers(new ArrayList<>());

        // Same task linked to both sub-projects
        Task shared = completedTask(1L, "SharedTask", "2026-04-01T08:00:00Z", "2026-04-01T09:00:00Z");
        shared.setProjects(new HashSet<>(Set.of(sub1, sub2)));
        sub1.setTasks(new HashSet<>(Set.of(shared)));
        sub2.setTasks(new HashSet<>(Set.of(shared)));
        project.setSubprojects(List.of(sub1, sub2));

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        // "SharedTask" should appear exactly once
        long count = response.getBody().chars()
                .filter(c -> c == '\n')
                .count();
        assertThat(count).isEqualTo(2); // header + 1 task row
    }

    @Test
    void export_hierarchyPath_appearsInCsv() {
        Project sub = new Project();
        sub.setId(2L); sub.setName("Chapter 1"); sub.setUser(user);
        sub.setSubprojects(new ArrayList<>()); sub.setMembers(new ArrayList<>());

        Task t = new Task();
        t.setDescription("Write draft");
        t.setStartTime(Instant.parse("2026-04-01T08:00:00Z"));
        t.setEndTime(Instant.parse("2026-04-01T09:00:00Z"));
        t.setUser(user);
        t.setProjects(new HashSet<>(Set.of(sub)));
        sub.setTasks(new HashSet<>(Set.of(t)));
        project.setSubprojects(List.of(sub));

        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        assertThat(response.getBody()).contains("Thesis > Chapter 1");
    }

    // ── Error paths ─────────────────────────────────────────────────────────────

    @Test
    void export_projectNotFound_throws() {
        when(projectRepository.findByIdAndMember(99L, user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exportService.export("alice@example.com", 99L, "csv", null, null))
                .isInstanceOf(ProjectNotFoundException.class);
    }

    @Test
    void export_userNotFound_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exportService.export("ghost@example.com", 1L, "csv", null, null))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }

    // ── JSON export: running task has null endTime → duration 0, endTime null ──

    @Test
    void export_json_runningTask_durationZeroAndEndTimeNull() {
        Task running = new Task();
        running.setDescription("Active work");
        running.setStartTime(Instant.parse("2026-06-01T09:00:00Z"));
        running.setEndTime(null);
        running.setUser(user);
        running.setProjects(new HashSet<>(Set.of(project)));
        project.setTasks(new HashSet<>(Set.of(running)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "json", null, null);

        // durationSeconds must be 0 and endTime field must be null (not "null" string)
        assertThat(response.getBody()).contains("\"durationSeconds\":0");
        assertThat(response.getBody()).contains("\"endTime\":null");
    }

    // ── csvEscape: null value → returns empty string ───────────────────────────

    @Test
    void export_csv_nullDescription_rendersAsEmptyField() {
        Task t = new Task();
        t.setDescription(null); // description is null → csvEscape(null) → ""
        t.setStartTime(Instant.parse("2026-05-01T08:00:00Z"));
        t.setEndTime(Instant.parse("2026-05-01T09:00:00Z"));
        t.setUser(user);
        t.setProjects(new HashSet<>(Set.of(project)));
        project.setTasks(new HashSet<>(Set.of(t)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        // Null description → empty CSV field: the field between the first and second comma
        // on the data row must be empty (no text). The row starts with the task id, then
        // an empty description field — so we get ",," (id + empty-desc + next-field).
        assertThat(response.getBody()).contains(",,");
        // The description field itself must not contain the literal text "null"
        String dataRow = response.getBody().lines()
                .filter(l -> !l.startsWith("task_id"))
                .findFirst().orElseThrow();
        String[] cols = dataRow.split(",", -1);
        assertThat(cols[1]).isEmpty(); // description column is blank
    }

    // ── csvEscape: value contains newline → must be quoted ────────────────────

    @Test
    void export_csv_descriptionWithNewline_isQuotedInCsv() {
        Task t = completedTask(1L, "Line1\nLine2", "2026-04-01T08:00:00Z", "2026-04-01T09:00:00Z");
        project.setTasks(new HashSet<>(Set.of(t)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", null, null);

        // A value containing a newline must be wrapped in double quotes
        assertThat(response.getBody()).contains("\"Line1\nLine2\"");
    }

    // ── isInRange false: task startTime < from → excluded from export ─────────

    @Test
    void export_csv_taskBeforeFrom_isExcluded() {
        Task early = completedTask(1L, "Before", "2026-03-01T08:00:00Z", "2026-03-01T09:00:00Z");
        Task inRange = completedTask(2L, "InRange", "2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");
        project.setTasks(new HashSet<>(Set.of(early, inRange)));
        when(projectRepository.findByIdAndMember(1L, user)).thenReturn(Optional.of(project));

        Instant from = Instant.parse("2026-06-01T00:00:00Z");
        ResponseEntity<String> response = exportService.export("alice@example.com", 1L, "csv", from, null);

        assertThat(response.getBody()).contains("InRange");
        assertThat(response.getBody()).doesNotContain("Before");
    }
}
