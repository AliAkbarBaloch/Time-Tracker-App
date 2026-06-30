package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
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
class ProjectControllerEditDeleteTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired ProjectRepository projectRepository;
    @Autowired TaskRepository taskRepository;

    private String jwt;
    private String otherJwt;
    private Long projectId;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        // primary user
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("eve@example.com", "password123", "Eve"))))
                .andExpect(status().isCreated());
        MvcResult r1 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("eve@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r1.getResponse().getContentAsString()).get("token").asText();

        // second user
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("frank2@example.com", "password123", "Frank2"))))
                .andExpect(status().isCreated());
        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("frank2@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();

        MvcResult proj = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("Original", "desc", null))))
                .andExpect(status().isCreated())
                .andReturn();
        projectId = objectMapper.readTree(proj.getResponse().getContentAsString()).get("id").asLong();
    }

    // --- PUT /api/projects/{id} ---

    @Test
    void updateProject_validRequest_returns200WithUpdatedName() throws Exception {
        mockMvc.perform(put("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateProjectRequest("Renamed", "new desc"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Renamed")))
                .andExpect(jsonPath("$.description", is("new desc")));
    }

    @Test
    void updateProject_duplicateName_returns409() throws Exception {
        mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateProjectRequest("Other", null, null))))
                .andExpect(status().isCreated());

        mockMvc.perform(put("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateProjectRequest("Other", null))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already exists")));
    }

    @Test
    void updateProject_sameNameAllowed_returns200() throws Exception {
        mockMvc.perform(put("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateProjectRequest("Original", "updated desc"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Original")));
    }

    @Test
    void updateProject_otherUsersProject_returns404() throws Exception {
        mockMvc.perform(put("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + otherJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateProjectRequest("Stolen", null))))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateProject_withoutToken_returns401() throws Exception {
        mockMvc.perform(put("/api/projects/" + projectId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateProjectRequest("X", null))))
                .andExpect(status().isUnauthorized());
    }

    // --- DELETE /api/projects/{id} ---

    @Test
    void deleteProject_noAssociations_returns204() throws Exception {
        mockMvc.perform(delete("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void deleteProject_withTasks_withoutForce_returns409WithWarning() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("task", start, end, List.of(projectId)))))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.taskCount", is(1)));
    }

    @Test
    void deleteProject_withTasksAndForce_returns204AndDisassociatesTasks() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("task", start, end, List.of(projectId)))))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/projects/" + projectId + "?force=true")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteProject_withSubprojects_withoutForce_returns409() throws Exception {
        mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("Child", null, projectId))))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.subprojectCount", is(1)));
    }

    @Test
    void deleteProject_otherUsersProject_returns404() throws Exception {
        mockMvc.perform(delete("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteProject_withoutToken_returns401() throws Exception {
        mockMvc.perform(delete("/api/projects/" + projectId))
                .andExpect(status().isUnauthorized());
    }
}
