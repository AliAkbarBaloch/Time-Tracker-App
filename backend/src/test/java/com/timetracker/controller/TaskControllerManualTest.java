package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerManualTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("eve@example.com", "password123", "Eve"))))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("eve@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void createTask_validRequest_returns201() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Reading", start, end, null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.description", is("Reading")))
                .andExpect(jsonPath("$.running", is(false)))
                .andExpect(jsonPath("$.endTime", notNullValue()));
    }

    @Test
    void createTask_startAfterEnd_returns400() throws Exception {
        Instant start = Instant.now().minusSeconds(60);
        Instant end   = Instant.now().minusSeconds(3600);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Bad", start, end, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("before end")));
    }

    @Test
    void createTask_missingStartTime_returns400() throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"No start\",\"endTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createTask_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/tasks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("X", Instant.now().minusSeconds(60), Instant.now(), null))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listTasks_returnsAllUserTasks() throws Exception {
        Instant s1 = Instant.now().minusSeconds(7200);
        Instant s2 = Instant.now().minusSeconds(3600);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Task A", s1, s1.plusSeconds(1800), null))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Task B", s2, s2.plusSeconds(900), null))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[*].description", hasItems("Task A", "Task B")));
    }

    @Test
    void listTasks_empty_returnsEmptyArray() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }
}
