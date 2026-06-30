package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
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
class TaskControllerStopTest {

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
                        new RegisterRequest("bob@example.com", "password123", "Bob"))))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("bob@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void stopTask_whenRunning_returns200WithEndTime() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/stop")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running", is(false)))
                .andExpect(jsonPath("$.endTime", notNullValue()))
                .andExpect(jsonPath("$.startTime", notNullValue()));
    }

    @Test
    void stopTask_whenNoneRunning_returns404() throws Exception {
        mockMvc.perform(post("/api/tasks/stop")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message", containsString("No timer")));
    }

    @Test
    void stopTask_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/tasks/stop"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void stopTask_activeTaskGoneAfterStop() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/stop")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/tasks/active")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());
    }

    @Test
    void stopTask_cannotStopTwice_returns404() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks/stop")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/tasks/stop")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNotFound());
    }
}
