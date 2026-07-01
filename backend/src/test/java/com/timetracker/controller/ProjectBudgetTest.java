package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.InviteMemberRequest;
import com.timetracker.dto.project.UpdateProjectRequest;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectBudgetTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;
    private String memberJwt;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("budget@example.com", "password123", "BudgetUser"))))
                .andExpect(status().isCreated());

        MvcResult r1 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("budget@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r1.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("member@example.com", "password123", "Member"))))
                .andExpect(status().isCreated());

        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("member@example.com", "password123"))))
                .andReturn();
        memberJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();
    }

    private Long createProject(String name, Double budgetHours) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest(name, null, null, budgetHours))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    private void addTask(String token, Long projectId, long startEpoch, long endEpoch) throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateTaskRequest(
                        "Task",
                        Instant.ofEpochSecond(startEpoch),
                        Instant.ofEpochSecond(endEpoch),
                        projectId == null ? null : List.of(projectId)))))
                .andExpect(status().isCreated());
    }

    // ── AC: Creating a project with budgetHours = 10 stores the value ─────────

    @Test
    void createProject_withBudget_storesBudgetHours() throws Exception {
        Long id = createProject("BudgetProject", 10.0);

        mockMvc.perform(get("/api/projects/" + id + "/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetHours").value(10.0));
    }

    // ── AC: null budget means no budget ───────────────────────────────────────

    @Test
    void createProject_withNullBudget_noBudgetInSummary() throws Exception {
        Long id = createProject("NoBudget", null);

        mockMvc.perform(get("/api/projects/" + id + "/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetHours").doesNotExist());
    }

    // ── AC: budgetStatus ON_TRACK (< 80%) ─────────────────────────────────────

    @Test
    void summary_onTrackStatus_when_usedLessThan80Percent() throws Exception {
        Long id = createProject("TrackProject", 10.0); // 10h budget
        // Add 5h of tasks (50% used → ON_TRACK)
        addTask(jwt, id, 0, 5 * 3600);

        mockMvc.perform(get("/api/projects/" + id + "/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetStatus").value("ON_TRACK"))
                .andExpect(jsonPath("$.budgetPercent").value(closeTo(50.0, 0.01)));
    }

    // ── AC: budgetStatus WARNING (80–99%) ─────────────────────────────────────

    @Test
    void summary_warningStatus_when_usedBetween80And100Percent() throws Exception {
        Long id = createProject("WarnProject", 10.0); // 10h budget
        // Add 9h (90% used → WARNING)
        addTask(jwt, id, 0, 9 * 3600);

        mockMvc.perform(get("/api/projects/" + id + "/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetStatus").value("WARNING"))
                .andExpect(jsonPath("$.budgetPercent").value(closeTo(90.0, 0.01)));
    }

    // ── AC: budgetStatus OVER_BUDGET (≥ 100%) ────────────────────────────────

    @Test
    void summary_overBudgetStatus_when_usedExceedsBudget() throws Exception {
        Long id = createProject("OverProject", 10.0); // 10h budget
        // Add 12h (120% used → OVER_BUDGET)
        addTask(jwt, id, 0, 12 * 3600);

        mockMvc.perform(get("/api/projects/" + id + "/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetStatus").value("OVER_BUDGET"))
                .andExpect(jsonPath("$.budgetPercent").value(closeTo(120.0, 0.01)));
    }

    // ── AC: Updating budgetHours persists new value ───────────────────────────

    @Test
    void updateProject_changesBudgetHours() throws Exception {
        Long id = createProject("UpdateBudget", 5.0);

        mockMvc.perform(put("/api/projects/" + id)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateProjectRequest("UpdateBudget", null, 20.0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetHours").value(20.0));
    }

    // ── AC: Updating budgetHours to null removes the budget ───────────────────

    @Test
    void updateProject_nullBudget_removesBudget() throws Exception {
        Long id = createProject("RemoveBudget", 5.0);

        mockMvc.perform(put("/api/projects/" + id)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateProjectRequest("RemoveBudget", null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.budgetHours").doesNotExist());
    }

    // ── AC: For shared projects, budget counts time from all members ──────────

    @Test
    void summary_sharedProject_budgetCountsAllMembersTime() throws Exception {
        Long id = createProject("SharedBudget", 10.0); // 10h budget

        // Invite member
        mockMvc.perform(post("/api/projects/" + id + "/members")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new InviteMemberRequest("member@example.com"))))
                .andExpect(status().isCreated());

        // Owner logs 3h
        addTask(jwt, id, 0, 3 * 3600);
        // Member logs 4h
        addTask(memberJwt, id, 10000, 10000 + 4 * 3600);

        // Total = 7h → 70% of 10h → ON_TRACK
        mockMvc.perform(get("/api/projects/" + id + "/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usedHours").value(closeTo(7.0, 0.01)))
                .andExpect(jsonPath("$.budgetPercent").value(closeTo(70.0, 0.01)))
                .andExpect(jsonPath("$.budgetStatus").value("ON_TRACK"));
    }

    // ── AC: budgetHours is returned in project list response ──────────────────

    @Test
    void listProjects_returnsBudgetHours() throws Exception {
        createProject("ListBudget", 8.0);

        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].budgetHours").value(8.0));
    }
}
