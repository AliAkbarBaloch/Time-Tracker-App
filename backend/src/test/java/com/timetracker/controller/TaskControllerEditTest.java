package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.UpdateTaskRequest;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerEditTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;
    private String otherJwt;
    private Long taskId;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        // primary user
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("frank@example.com", "password123", "Frank"))))
                .andExpect(status().isCreated());
        MvcResult r1 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("frank@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r1.getResponse().getContentAsString()).get("token").asText();

        // second user
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("grace@example.com", "password123", "Grace"))))
                .andExpect(status().isCreated());
        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("grace@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();

        // create a task owned by primary user
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        MvcResult created = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Original", start, end, null))))
                .andExpect(status().isCreated())
                .andReturn();
        taskId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void updateTask_validRequest_returns200WithUpdatedTask() throws Exception {
        Instant newStart = Instant.now().minusSeconds(7200);
        Instant newEnd   = Instant.now().minusSeconds(5400);

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("Updated desc", newStart, newEnd, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description", is("Updated desc")))
                .andExpect(jsonPath("$.running", is(false)));
    }

    @Test
    void updateTask_startAfterEnd_returns400() throws Exception {
        Instant start = Instant.now().minusSeconds(1800);
        Instant end   = Instant.now().minusSeconds(3600);

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("X", start, end, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("before end")));
    }

    @Test
    void updateTask_taskNotFound_returns404() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(put("/api/tasks/99999")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("X", start, end, null))))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateTask_otherUsersTask_returns403() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + otherJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("Steal", start, end, null))))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateTask_withoutToken_returns401() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(put("/api/tasks/" + taskId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("X", start, end, null))))
                .andExpect(status().isUnauthorized());
    }
}
