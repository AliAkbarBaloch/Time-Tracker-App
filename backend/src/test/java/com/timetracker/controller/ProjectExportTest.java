package com.timetracker.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for US-024: Export project tasks as CSV or JSON.
 *
 * Setup: Alice owns a project with one sub-project.  Both users log tasks so
 * that the multi-user and recursive-collection paths are exercised.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectExportTest {

    @Autowired MockMvc        mockMvc;
    @Autowired ObjectMapper   objectMapper;
    @Autowired UserRepository     userRepository;
    @Autowired TaskRepository     taskRepository;
    @Autowired ProjectRepository  projectRepository;

    private String aliceJwt;
    private String eveJwt;       // not a member of Alice's project
    private Long   rootProjectId;
    private Long   subProjectId;

    // ── Setup ─────────────────────────────────────────────────────────────────

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        aliceJwt = registerAndLogin("alice@export.com", "Alice");
        eveJwt   = registerAndLogin("eve@export.com",   "Eve");

        // Alice creates a root project and a sub-project under it
        rootProjectId = createProject(aliceJwt, "Thesis", null);
        subProjectId  = createProject(aliceJwt, "Literature Review", rootProjectId);
    }

    // ── CSV format ────────────────────────────────────────────────────────────

    /**
     * AC: default format is CSV; response has Content-Disposition: attachment.
     */
    @Test
    void export_csv_hasAttachmentContentDispositionHeader() throws Exception {
        logTask(aliceJwt, "Root task", 3600, rootProjectId);

        mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", containsString(".csv")));
    }

    /**
     * AC: CSV response starts with the expected header row.
     */
    @Test
    void export_csv_startsWithHeaderRow() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).startsWith("task_id,description,start_time,end_time,duration_seconds,projects,user");
    }

    /**
     * AC: CSV row contains correct task data (description, duration, user).
     */
    @Test
    void export_csv_containsCorrectTaskRow() throws Exception {
        logTask(aliceJwt, "Study session", 3600, rootProjectId);

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Check key columns appear in the row
        assertThat(body).contains("Study session");
        assertThat(body).contains(",3600,");   // duration_seconds column
        assertThat(body).contains("Alice");    // user column
    }

    /**
     * AC: CSV projects column shows root project name for root-level tasks.
     */
    @Test
    void export_csv_projectsColumnShowsProjectName() throws Exception {
        logTask(aliceJwt, "Root work", 900, rootProjectId);

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("Thesis");
    }

    // ── JSON format ───────────────────────────────────────────────────────────

    /**
     * AC: ?format=json returns JSON with Content-Disposition: attachment (.json).
     */
    @Test
    void export_json_hasAttachmentContentDispositionHeader() throws Exception {
        logTask(aliceJwt, "JSON task", 1800, rootProjectId);

        mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("format", "json")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", containsString(".json")));
    }

    /**
     * AC: JSON response contains "project", "exportedAt", and "tasks" top-level keys.
     */
    @Test
    void export_json_topLevelStructureIsCorrect() throws Exception {
        logTask(aliceJwt, "JSON task", 1800, rootProjectId);

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("format", "json")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(root.has("project")).isTrue();
        assertThat(root.has("exportedAt")).isTrue();
        assertThat(root.has("tasks")).isTrue();
        assertThat(root.get("project").asText()).isEqualTo("Thesis");
    }

    /**
     * AC: JSON task entries include id, description, startTime, endTime,
     *     durationSeconds, projects, and user fields.
     */
    @Test
    void export_json_taskEntryHasAllRequiredFields() throws Exception {
        logTask(aliceJwt, "Full field task", 7200, rootProjectId);

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("format", "json")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root  = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode tasks = root.get("tasks");
        assertThat(tasks.size()).isEqualTo(1);

        JsonNode task = tasks.get(0);
        assertThat(task.has("id")).isTrue();
        assertThat(task.has("description")).isTrue();
        assertThat(task.has("startTime")).isTrue();
        assertThat(task.has("endTime")).isTrue();
        assertThat(task.has("durationSeconds")).isTrue();
        assertThat(task.has("projects")).isTrue();
        assertThat(task.has("user")).isTrue();

        assertThat(task.get("description").asText()).isEqualTo("Full field task");
        assertThat(task.get("durationSeconds").asLong()).isEqualTo(7200L);
        assertThat(task.get("user").asText()).isEqualTo("Alice");
    }

    // ── Subproject inclusion ──────────────────────────────────────────────────

    /**
     * AC: tasks from sub-projects are included in the export of the parent project.
     */
    @Test
    void export_includesTasksFromSubprojects() throws Exception {
        logTask(aliceJwt, "Root task", 1800, rootProjectId);
        logTask(aliceJwt, "Sub task",  3600, subProjectId);

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Both tasks should appear in the export
        assertThat(body).contains("Root task");
        assertThat(body).contains("Sub task");
    }

    /**
     * AC: sub-project tasks show the full hierarchy path
     *     "Root > Sub" in the projects column.
     */
    @Test
    void export_subprojectTasksShowHierarchyPath() throws Exception {
        logTask(aliceJwt, "Sub work", 1200, subProjectId);

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Expect the full hierarchy path for the sub-project task
        assertThat(body).contains("Thesis > Literature Review");
    }

    // ── Date range / month filter ─────────────────────────────────────────────

    /**
     * AC: ?year=2026&month=6 returns only tasks whose startTime falls in June 2026.
     */
    @Test
    void export_yearMonthFilter_returnsOnlyMatchingTasks() throws Exception {
        // June task — should appear
        logTaskAt(aliceJwt, "June task",  1800, rootProjectId, "2026-06-15T10:00:00Z", "2026-06-15T10:30:00Z");
        // July task — should NOT appear
        logTaskAt(aliceJwt, "July task",  900,  rootProjectId, "2026-07-01T10:00:00Z", "2026-07-01T10:15:00Z");

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("year",  "2026")
                .param("month", "6")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("June task");
        assertThat(body).doesNotContain("July task");
    }

    /**
     * AC: an empty date range returns a valid CSV with only the header row.
     */
    @Test
    void export_emptyDateRange_returnsCsvHeaderOnly() throws Exception {
        logTask(aliceJwt, "Real task", 3600, rootProjectId);

        // Request a future month that has no tasks
        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("year",  "2099")
                .param("month", "1")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString().trim();
        // Should only contain the header row with no data rows
        assertThat(body).startsWith("task_id");
        String[] lines = body.split("\n");
        assertThat(lines).hasSize(1);
    }

    // ── Running tasks ─────────────────────────────────────────────────────────

    /**
     * AC: a timer started via /api/tasks/start has no project association and
     * therefore does NOT appear in the project export.
     * Running tasks can only gain project membership via CreateTaskRequest or
     * UpdateTaskRequest, both of which require a non-null endTime.
     */
    @Test
    void export_runningTimerWithoutProject_doesNotAppearInExport() throws Exception {
        logTask(aliceJwt, "Completed task", 3600, rootProjectId);

        // Start a free-running timer — no project IDs are sent
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new StartTaskRequest("Active timer"))))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // The completed task appears; the running timer without project does not
        assertThat(body).contains("Completed task");
        assertThat(body).doesNotContain("Active timer");
    }

    // ── Access control ────────────────────────────────────────────────────────

    /**
     * AC: non-members receive 404 (project existence not leaked).
     */
    @Test
    void export_nonMember_returns404() throws Exception {
        mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .header("Authorization", "Bearer " + eveJwt))
                .andExpect(status().isNotFound());
    }

    /**
     * AC: unauthenticated request returns 401.
     */
    @Test
    void export_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/projects/{id}/export", rootProjectId))
                .andExpect(status().isUnauthorized());
    }

    // ── resolveFrom / resolveTo: year present, month absent → no filter applied ─

    /**
     * When year is provided but month is omitted, resolveFrom/resolveTo both
     * return null (the year+month branch is skipped), so all tasks are exported.
     */
    @Test
    void export_yearOnlyNoMonth_returnsAllTasks() throws Exception {
        // Tasks in different months of the same year
        logTaskAt(aliceJwt, "March task", 1800, rootProjectId,
                "2026-03-10T08:00:00Z", "2026-03-10T08:30:00Z");
        logTaskAt(aliceJwt, "June task", 3600, rootProjectId,
                "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z");

        // Provide year but NOT month — resolveFrom and resolveTo both return null
        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("year", "2026")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        // Both tasks must appear since no date window was applied
        assertThat(body).contains("March task");
        assertThat(body).contains("June task");
    }

    /**
     * When an explicit ISO from/to string is supplied, resolveFrom parses it directly
     * (the from != null branch), bypassing the year+month path.
     */
    @Test
    void export_explicitFromString_usedDirectlyAndFilters() throws Exception {
        logTaskAt(aliceJwt, "Before filter", 1800, rootProjectId,
                "2026-05-31T23:00:00Z", "2026-05-31T23:30:00Z");
        logTaskAt(aliceJwt, "After filter",  3600, rootProjectId,
                "2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");

        MvcResult result = mockMvc.perform(get("/api/projects/{id}/export", rootProjectId)
                .param("from", "2026-06-01T00:00:00Z")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("After filter");
        assertThat(body).doesNotContain("Before filter");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String registerAndLogin(String email, String displayName) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest(email, "password123", displayName))))
                .andExpect(status().isCreated());
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest(email, "password123"))))
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    private Long createProject(String jwt, String name, Long parentId) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest(name, null, parentId, null))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    /** Log a completed task with a fixed start time of 2026-06-15T09:00:00Z. */
    private void logTask(String jwt, String desc, int durationSeconds, Long... projectIds) throws Exception {
        Instant start = Instant.parse("2026-06-15T09:00:00Z");
        logTaskAt(jwt, desc, durationSeconds, projectIds[0], start.toString(),
                start.plusSeconds(durationSeconds).toString(),
                java.util.Arrays.copyOfRange(projectIds, 1, projectIds.length));
    }

    /** Log a completed task with explicit start and end ISO strings. */
    private void logTaskAt(String jwt, String desc, int durationSeconds,
                            Long projectId, String startIso, String endIso,
                            Long... extraProjectIds) throws Exception {
        Long[] projectIds = new Long[1 + extraProjectIds.length];
        projectIds[0] = projectId;
        System.arraycopy(extraProjectIds, 0, projectIds, 1, extraProjectIds.length);
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest(desc, Instant.parse(startIso), Instant.parse(endIso),
                                List.of(projectIds)))))
                .andExpect(status().isCreated());
    }
}
