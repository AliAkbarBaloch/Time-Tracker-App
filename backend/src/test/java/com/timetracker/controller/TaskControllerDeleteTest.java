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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerDeleteTest {

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

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("henry@example.com", "password123", "Henry"))))
                .andExpect(status().isCreated());
        MvcResult r1 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("henry@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r1.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("iris@example.com", "password123", "Iris"))))
                .andExpect(status().isCreated());
        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("iris@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();

        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);
        MvcResult created = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("To delete", start, end, null))))
                .andExpect(status().isCreated())
                .andReturn();
        taskId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void deleteTask_validOwner_returns204() throws Exception {
        mockMvc.perform(delete("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteTask_taskNotFound_returns404() throws Exception {
        mockMvc.perform(delete("/api/tasks/99999")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteTask_otherUsersTask_returns403() throws Exception {
        mockMvc.perform(delete("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteTask_withoutToken_returns401() throws Exception {
        mockMvc.perform(delete("/api/tasks/" + taskId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteTask_taskRemovedFromList() throws Exception {
        mockMvc.perform(delete("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }
}
