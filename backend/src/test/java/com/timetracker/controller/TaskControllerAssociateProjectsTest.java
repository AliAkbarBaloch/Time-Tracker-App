package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
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
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerAssociateProjectsTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;
    private String otherJwt;
    private Long projectId;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("user@example.com", "password123", "User"))))
                .andExpect(status().isCreated());
        MvcResult r1 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("user@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r1.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("other@example.com", "password123", "Other"))))
                .andExpect(status().isCreated());
        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("other@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();

        MvcResult proj = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("Thesis", "My thesis", null, null))))
                .andExpect(status().isCreated())
                .andReturn();
        projectId = objectMapper.readTree(proj.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void createTask_withProjectId_returns201WithProjectInResponse() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.projects[0].id", is(projectId.intValue())))
                .andExpect(jsonPath("$.projects[0].name", is("Thesis")));
    }

    @Test
    void createTask_withNoProjects_returns201WithEmptyProjectList() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projects", hasSize(0)));
    }

    @Test
    void createTask_withOtherUsersProjectId_returns404() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + otherJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateTask_addProject_returns200WithProject() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        MvcResult created = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, null))))
                .andExpect(status().isCreated())
                .andReturn();
        Long taskId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.projects[0].name", is("Thesis")));
    }

    @Test
    void updateTask_removeProject_returns200WithEmptyProjects() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        MvcResult created = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isCreated())
                .andReturn();
        Long taskId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("Study", start, end, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects", hasSize(0)));
    }

    @Test
    void listTasks_returnsProjectsInEachTask() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].projects", hasSize(1)))
                .andExpect(jsonPath("$[0].projects[0].name", is("Thesis")));
    }

    @Test
    void projectTotalSeconds_updatesAfterTaskAssociation() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].totalSeconds", is(1800)));
    }

    @Test
    void projectTotalSeconds_updatesAfterTaskDisassociation() throws Exception {
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(1800);

        MvcResult created = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Study", start, end, List.of(projectId)))))
                .andExpect(status().isCreated())
                .andReturn();
        Long taskId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new UpdateTaskRequest("Study", start, end, null))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].totalSeconds", is(0)));
    }
}
