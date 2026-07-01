package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.repository.ProjectMemberRepository;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for US-022: Project Sharing.
 * Covers all Acceptance Criteria:
 *   AC1  — Owner can invite a registered user; invitee sees project in list
 *   AC2  — Inviting unknown email returns 404
 *   AC3  — Inviting already-invited user returns 409
 *   AC4  — Member can create and associate tasks with the shared project
 *   AC5  — Non-member GET /api/projects/{id}/summary returns 404 (same as not found)
 *   AC6  — Owner can remove a member; removed member loses access
 *   AC7  — Owner cannot remove themselves (400)
 *   AC8  — Only owner can edit or delete the project (member gets 404)
 *   AC9  — Shared project appears with shared=true in list for the member
 *   AC10 — GET /api/projects/{id}/members returns name, email, role for each participant
 *   AC11 — Project summary aggregates tasks from all members (time aggregation across users)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectSharingTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired ProjectRepository projectRepository;
    @Autowired ProjectMemberRepository memberRepository;
    @Autowired TaskRepository taskRepository;

    // Two separate users: alice (project owner) and bob (invitee)
    private String aliceJwt;
    private String bobJwt;
    private Long projectId;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        memberRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        // Register alice (project owner)
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("alice@example.com", "password123", "Alice"))))
                .andExpect(status().isCreated());

        aliceJwt = loginAndGetToken("alice@example.com", "password123");

        // Register bob (will be invited as member)
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("bob@example.com", "password123", "Bob"))))
                .andExpect(status().isCreated());

        bobJwt = loginAndGetToken("bob@example.com", "password123");

        // Alice creates a project
        MvcResult createResult = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("SharedProject", "A shared project", null))))
                .andExpect(status().isCreated())
                .andReturn();

        projectId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("id").asLong();
    }

    // ── AC1: Invite and visibility ────────────────────────────────────────────

    @Test
    void invite_registeredUser_returns201WithMemberResponse() throws Exception {
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email", is("bob@example.com")))
                .andExpect(jsonPath("$.displayName", is("Bob")))
                .andExpect(jsonPath("$.role", is("MEMBER")));
    }

    @Test
    void invite_sharedProjectAppearsInMemberProjectList_withSharedFlag() throws Exception {
        // Alice invites Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Bob should now see SharedProject in his list with shared=true
        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name", is("SharedProject")))
                .andExpect(jsonPath("$[0].shared", is(true)));
    }

    @Test
    void ownProject_appearsWithSharedFalse_inOwnerList() throws Exception {
        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name", is("SharedProject")))
                .andExpect(jsonPath("$[0].shared", is(false)));
    }

    // ── AC2: Unknown email returns 404 ────────────────────────────────────────

    @Test
    void invite_unknownEmail_returns404() throws Exception {
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nobody@example.com\"}"))
                .andExpect(status().isNotFound());
    }

    // ── AC3: Duplicate invite returns 409 ─────────────────────────────────────

    @Test
    void invite_alreadyMember_returns409() throws Exception {
        // First invite succeeds
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Second invite for the same user returns 409 Conflict
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already a member")));
    }

    // ── AC4: Member can associate tasks with shared project ───────────────────

    @Test
    void member_canCreateTaskAssociatedWithSharedProject() throws Exception {
        // Alice invites Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Bob creates a task linked to the shared project
        CreateTaskRequest taskReq = new CreateTaskRequest(
                "Bob's contribution",
                Instant.parse("2026-06-01T09:00:00Z"),
                Instant.parse("2026-06-01T10:00:00Z"),
                List.of(projectId));

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + bobJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(taskReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projects[0].id", is(projectId.intValue())));
    }

    // ── AC5: Non-member cannot view project summary ───────────────────────────

    @Test
    void nonMember_getProjectSummary_returns404() throws Exception {
        // Bob is NOT invited; attempting to access Alice's project returns 404
        mockMvc.perform(get("/api/projects/" + projectId + "/summary")
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isNotFound());
    }

    // ── AC6: Remove member; removed member loses access ───────────────────────

    @Test
    void removeInvitedMember_memberLosesProjectAccess() throws Exception {
        // Alice invites Bob then removes him
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        Long bobUserId = getBobUserId();

        mockMvc.perform(delete("/api/projects/" + projectId + "/members/" + bobUserId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isNoContent());

        // Bob can no longer view the project summary
        mockMvc.perform(get("/api/projects/" + projectId + "/summary")
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isNotFound());

        // Bob's project list is now empty
        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ── AC7: Owner cannot remove themselves ───────────────────────────────────

    @Test
    void owner_cannotRemoveThemselves_returns400() throws Exception {
        Long aliceUserId = getAliceUserId();

        mockMvc.perform(delete("/api/projects/" + projectId + "/members/" + aliceUserId)
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("owner")));
    }

    // ── AC8: Only owner can edit or delete ────────────────────────────────────

    @Test
    void member_cannotEditProject_returns404() throws Exception {
        // Invite Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Bob tries to rename the project — should get 404 (findByIdAndUser fails for non-owner)
        mockMvc.perform(put("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + bobJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"HackedName\",\"description\":\"hacked\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void member_cannotDeleteProject_returns404() throws Exception {
        // Invite Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Bob tries to delete the project — should get 404
        mockMvc.perform(delete("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isNotFound());
    }

    // ── AC10: GET /members returns name, email, role ──────────────────────────

    @Test
    void listMembers_returnsOwnerAndMember_withCorrectFields() throws Exception {
        // Invite Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].email", hasItems("alice@example.com", "bob@example.com")))
                .andExpect(jsonPath("$[*].role", hasItems("OWNER", "MEMBER")))
                .andExpect(jsonPath("$[*].displayName", hasItems("Alice", "Bob")));
    }

    @Test
    void listMembers_accessibleToMember_notJustOwner() throws Exception {
        // Invite Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Bob (MEMBER role) should also be able to list members
        mockMvc.perform(get("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void listMembers_nonMember_gets404() throws Exception {
        // Bob is not invited; trying to list members should return 404
        mockMvc.perform(get("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + bobJwt))
                .andExpect(status().isNotFound());
    }

    // ── AC11: Time aggregation across members ─────────────────────────────────

    @Test
    void projectSummary_aggregatesTasksFromAllMembers() throws Exception {
        // Invite Bob
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"bob@example.com\"}"))
                .andExpect(status().isCreated());

        // Alice logs 1 hour
        CreateTaskRequest aliceTask = new CreateTaskRequest(
                "Alice's task",
                Instant.parse("2026-06-01T08:00:00Z"),
                Instant.parse("2026-06-01T09:00:00Z"),
                List.of(projectId));
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(aliceTask)))
                .andExpect(status().isCreated());

        // Bob logs 2 hours
        CreateTaskRequest bobTask = new CreateTaskRequest(
                "Bob's task",
                Instant.parse("2026-06-01T10:00:00Z"),
                Instant.parse("2026-06-01T12:00:00Z"),
                List.of(projectId));
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + bobJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(bobTask)))
                .andExpect(status().isCreated());

        // Project summary should show 3 hours total (1 + 2 = 10800 seconds)
        mockMvc.perform(get("/api/projects/" + projectId + "/summary")
                .header("Authorization", "Bearer " + aliceJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(10800)))
                .andExpect(jsonPath("$.tasks", hasSize(2)));
    }

    // ── Validation ────────────────────────────────────────────────────────────

    @Test
    void invite_invalidEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"not-an-email\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invite_blankEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── Helper methods ────────────────────────────────────────────────────────

    private String loginAndGetToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest(email, password))))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private Long getBobUserId() throws Exception {
        MvcResult membersResult = mockMvc.perform(get("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt))
                .andReturn();
        var members = objectMapper.readTree(membersResult.getResponse().getContentAsString());
        for (var member : members) {
            if ("bob@example.com".equals(member.get("email").asText())) {
                return member.get("userId").asLong();
            }
        }
        throw new IllegalStateException("Bob not found in members list");
    }

    private Long getAliceUserId() throws Exception {
        MvcResult membersResult = mockMvc.perform(get("/api/projects/" + projectId + "/members")
                .header("Authorization", "Bearer " + aliceJwt))
                .andReturn();
        var members = objectMapper.readTree(membersResult.getResponse().getContentAsString());
        for (var member : members) {
            if ("alice@example.com".equals(member.get("email").asText())) {
                return member.get("userId").asLong();
            }
        }
        throw new IllegalStateException("Alice not found in members list");
    }
}
