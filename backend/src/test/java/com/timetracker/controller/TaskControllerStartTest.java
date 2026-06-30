package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.task.StartTaskRequest;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerStartTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;

    private String jwt;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("alice@example.com", "password123", "Alice"))))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("alice@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void startTask_noDescription_returns201WithRunningTask() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.running", is(true)))
                .andExpect(jsonPath("$.endTime", nullValue()))
                .andExpect(jsonPath("$.startTime", notNullValue()));
    }

    @Test
    void startTask_withDescription_returnsDescriptionInResponse() throws Exception {
        StartTaskRequest req = new StartTaskRequest("Studying Java");
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description", is("Studying Java")));
    }

    @Test
    void startTask_whenAlreadyRunning_returns409() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("already running")));
    }

    @Test
    void startTask_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/tasks/start"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getActiveTask_afterStart_returns200WithTask() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/tasks/active")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running", is(true)));
    }

    @Test
    void getActiveTask_whenNoneRunning_returns204() throws Exception {
        mockMvc.perform(get("/api/tasks/active")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());
    }
}
