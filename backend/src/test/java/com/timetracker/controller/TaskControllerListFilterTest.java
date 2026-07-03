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
import java.time.temporal.ChronoUnit;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerListFilterTest {

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
                        new RegisterRequest("filter@example.com", "password123", "Filter"))))
                .andExpect(status().isCreated());
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("filter@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    private void createTask(String description, Instant start, Instant end) throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest(description, start, end, null))))
                .andExpect(status().isCreated());
    }

    @Test
    void listTasks_noParams_returnsAllTasks() throws Exception {
        Instant s1 = Instant.now().minusSeconds(7200);
        Instant s2 = Instant.now().minus(2, ChronoUnit.DAYS);
        createTask("Today task",     s1,                  s1.plusSeconds(1800));
        createTask("Two days ago",   s2,                  s2.plusSeconds(1800));

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    void listTasks_withFromAndTo_returnsOnlyTasksInRange() throws Exception {
        Instant now  = Instant.now();
        Instant from = now.minusSeconds(7200); // 2 hours ago
        Instant to   = now.plusSeconds(60);

        Instant taskStart = now.minusSeconds(3600); // 1h ago — within [from, to]
        createTask("In range",     taskStart,                   taskStart.plusSeconds(1800));
        createTask("Out of range", now.minus(2, ChronoUnit.DAYS), now.minus(2, ChronoUnit.DAYS).plusSeconds(1800));

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .param("from", from.toString())
                .param("to",   to.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].description", is("In range")));
    }

    @Test
    void listTasks_withFromAndTo_noTasksInRange_returnsEmpty() throws Exception {
        Instant now = Instant.now();
        createTask("Old task", now.minus(5, ChronoUnit.DAYS), now.minus(5, ChronoUnit.DAYS).plusSeconds(1800));

        Instant from = now.truncatedTo(ChronoUnit.DAYS);
        Instant to   = from.plus(1, ChronoUnit.DAYS);

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .param("from", from.toString())
                .param("to",   to.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)));
    }

    @Test
    void listTasks_withFromAndTo_sortedByStartTimeAscending() throws Exception {
        Instant now  = Instant.now();
        Instant from = now.minusSeconds(10800); // 3 hours ago
        Instant to   = now.plusSeconds(60);

        Instant start1 = now.minusSeconds(3600); // 1h ago
        Instant start2 = now.minusSeconds(7200); // 2h ago
        createTask("Second task", start1, start1.plusSeconds(900));
        createTask("First task",  start2, start2.plusSeconds(900));

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .param("from", from.toString())
                .param("to",   to.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].description", is("First task")))
                .andExpect(jsonPath("$.content[1].description", is("Second task")));
    }

    @Test
    void listTasks_withFromAndTo_returnsProjectsField() throws Exception {
        Instant now  = Instant.now();
        Instant from = now.minusSeconds(7200); // 2 hours ago
        Instant to   = now.plusSeconds(60);
        Instant s    = now.minusSeconds(3600);

        createTask("Task", s, s.plusSeconds(1800));

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .param("from", from.toString())
                .param("to",   to.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].projects", notNullValue()));
    }

    @Test
    void listTasks_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .param("from", Instant.now().truncatedTo(ChronoUnit.DAYS).toString())
                .param("to",   Instant.now().truncatedTo(ChronoUnit.DAYS).plus(1, ChronoUnit.DAYS).toString()))
                .andExpect(status().isUnauthorized());
    }
}
