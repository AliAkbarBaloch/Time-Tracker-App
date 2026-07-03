package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.task.CreateTaskRequest;
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
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for US-023: per-user contribution breakdown and
 * userId filter on the project summary and task-list endpoints.
 *
 * Setup: Alice (project owner) shares a project with Bob (member).
 * Both users log tasks so contributions can be verified.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SharedProjectSummaryTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String aliceJwt;
    private String bobJwt;
    private String eveJwt;      // never a project member
    private Long   projectId;
    private Long   aliceId;
    private Long   bobId;

    // ── Setup ─────────────────────────────────────────────────────────────────

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        aliceJwt = registerAndLogin("alice@shared.com", "Alice");
        bobJwt   = registerAndLogin("bob@shared.com",   "Bob");
        eveJwt   = registerAndLogin("eve@shared.com",   "Eve");

        // Alice creates the project
        MvcResult pr = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("SharedProject", "collab project", null, null))))
                .andExpect(status().isCreated())
                .andReturn();
        projectId = objectMapper.readTree(pr.getResponse().getContentAsString()).get("id").asLong();

        // Alice invites Bob — now both Alice and Bob appear in the members list
        mockMvc.perform(post("/api/projects/{id}/members", projectId)
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", "bob@shared.com"))))
                .andExpect(status().isCreated());

        // Resolve user IDs from the members list (userId is not in the auth response)
        aliceId = getMemberUserId("alice@shared.com");
        bobId   = getMemberUserId("bob@shared.com");
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

    /** Look up a userId from the project members list (Alice must be the caller). */
    private Long getMemberUserId(String email) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/projects/{id}/members", projectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andReturn();
        for (var node : objectMapper.readTree(r.getResponse().getContentAsString())) {
            if (email.equals(node.get("email").asText())) {
                return node.get("userId").asLong();
            }
        }
        throw new IllegalStateException("Member not found: " + email);
    }

    /** Get the database id for a non-member user (Eve) directly from the repository. */
    private Long getEveId() {
        return userRepository.findByEmail("eve@shared.com")
                .orElseThrow(() -> new IllegalStateException("Eve not found"))
                .getId();
    }

    private void logTask(String jwt, String desc, int durationSeconds, Long... projectIds) throws Exception {
        Instant start = Instant.parse("2026-06-15T09:00:00Z");
        Instant end   = start.plusSeconds(durationSeconds);
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest(desc, start, end, List.of(projectIds)))))
                .andExpect(status().isCreated());
    }

    // ── Tests ──────────────────────────────────────────────────────────────────

    /**
     * AC: summary returns contributions array with per-user totals when shared.
     * Alice logs 3600 s, Bob logs 1800 s → two entries in contributions.
     */
    @Test
    void summary_multiUserProject_returnsContributionsArray() throws Exception {
        logTask(aliceJwt, "Alice task", 3600, projectId);
        logTask(bobJwt,   "Bob task",   1800, projectId);

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contributions", hasSize(2)))
                .andExpect(jsonPath("$.totalSeconds", is(5400)));
    }

    /**
     * AC: task list entries include userName for shared projects.
     * Alice can see the owner's displayName on each task row.
     */
    @Test
    void summary_tasksIncludeUserName() throws Exception {
        logTask(aliceJwt, "Alice work", 3600, projectId);

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[0].userName", is("Alice")))
                .andExpect(jsonPath("$.tasks[0].userId", is(aliceId.intValue())));
    }

    /**
     * AC: GET /api/projects/{id}/summary?userId={id} returns only that user's
     * tasks and their individual total.
     */
    @Test
    void summary_userIdFilter_returnsOnlyTargetUserTasksAndTotal() throws Exception {
        logTask(aliceJwt, "Alice task", 3600, projectId);
        logTask(bobJwt,   "Bob task",   1800, projectId);

        // Filter to Bob only
        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .param("userId", bobId.toString())
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(1800)))   // Bob's total only
                .andExpect(jsonPath("$.tasks", hasSize(1)))
                .andExpect(jsonPath("$.tasks[0].description", is("Bob task")))
                .andExpect(jsonPath("$.contributions", hasSize(2))); // still shows all users
    }

    /**
     * AC: filtering by user updates totalSeconds to that user's contribution only.
     * contributions always carries all members for the frontend dropdown.
     */
    @Test
    void summary_userIdFilter_totalMatchesIndividualContribution() throws Exception {
        logTask(aliceJwt, "Alice A", 7200, projectId);
        logTask(bobJwt,   "Bob B",   3600, projectId);

        // Filter to Alice
        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .param("userId", aliceId.toString())
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(7200)))
                .andExpect(jsonPath("$.tasks", hasSize(1)))
                .andExpect(jsonPath("$.tasks[0].userName", is("Alice")))
                // contributions list still has both users
                .andExpect(jsonPath("$.contributions", hasSize(2)));
    }

    /**
     * AC: selecting "All users" (default, no userId param) shows the combined total.
     */
    @Test
    void summary_noUserIdFilter_returnsCombinedTotal() throws Exception {
        logTask(aliceJwt, "Alice task", 1800, projectId);
        logTask(bobJwt,   "Bob task",   3600, projectId);

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(5400)))
                .andExpect(jsonPath("$.tasks", hasSize(2)));
    }

    /**
     * AC: non-member using userId filter on a project they can see is still
     * gated — Eve cannot access the project at all (404) since findByIdAndMember
     * hides it from non-members.
     */
    @Test
    void summary_nonMemberAccess_returns404() throws Exception {
        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + eveJwt))
                .andExpect(status().isNotFound());
    }

    /**
     * AC: userId not in project returns 403.
     * Alice is a member but tries to filter by Eve's id (non-member) → 403.
     */
    @Test
    void summary_userIdNotInProject_returns403() throws Exception {
        long eveId = getEveId();

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .param("userId", String.valueOf(eveId))
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isForbidden());
    }

    /**
     * AC: project total = sum of all members' contributions (no double-counting).
     */
    @Test
    void summary_combinedTotal_equalsSum_ofContributions() throws Exception {
        logTask(aliceJwt, "Alice",  3600, projectId);
        logTask(bobJwt,   "Bob",    1800, projectId);

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(5400)))
                // contributions sum must equal totalSeconds
                .andExpect(jsonPath("$.contributions[*].totalSeconds",
                        containsInAnyOrder(3600, 1800)));
    }

    /**
     * AC: member (Bob) can also view the summary with per-user contributions.
     */
    @Test
    void summary_memberCanAccessContributions() throws Exception {
        logTask(aliceJwt, "Alice work", 3600, projectId);

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contributions", hasSize(greaterThanOrEqualTo(1))));
    }

    /**
     * AC: GET /api/tasks?projectId=&userId= returns tasks of the specified user
     * for members of the shared project.
     */
    @Test
    void taskList_userIdFilter_returnsMembersTasksForProject() throws Exception {
        logTask(aliceJwt, "Alice task", 3600, projectId);
        logTask(bobJwt,   "Bob task",   1800, projectId);

        // Alice filters task list by Bob
        mockMvc.perform(get("/api/tasks")
                .param("projectId", projectId.toString())
                .param("userId",    bobId.toString())
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].description", is("Bob task")));
    }

    /**
     * AC: non-member userId in task-list filter returns 403.
     */
    @Test
    void taskList_nonMemberUserId_returns403() throws Exception {
        long eveId = getEveId();

        mockMvc.perform(get("/api/tasks")
                .param("projectId", projectId.toString())
                .param("userId",    String.valueOf(eveId))
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isForbidden());
    }

    /**
     * AC: userId filter on tasks without a projectId returns 403
     * (userId alone has no membership context).
     */
    @Test
    void taskList_userIdWithoutProjectId_returns403() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .param("userId", bobId.toString())
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isForbidden());
    }
}
