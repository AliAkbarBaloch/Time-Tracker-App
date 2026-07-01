package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.TaskTemplateRepository;
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

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskTemplateTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;
    @Autowired TaskTemplateRepository templateRepository;

    private String jwt;
    private String otherJwt;

    @BeforeEach
    void setUp() throws Exception {
        templateRepository.deleteAll();
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("template@example.com", "password123", "TemplateUser"))))
                .andExpect(status().isCreated());

        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("template@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();

        // Second user for cross-user isolation test
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("other@example.com", "password123", "OtherUser"))))
                .andExpect(status().isCreated());

        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("other@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Long createProject(String token, String name) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest(name, null, null, null))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    private Long createTemplate(String token, String name, String description, List<Long> projectIds) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("name", name);
        body.put("description", description);
        body.put("projectIds", projectIds);
        MvcResult r = mockMvc.perform(post("/api/task-templates")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    @Test
    void createTemplate_returnsCreatedWithAllFields() throws Exception {
        Long projectId = createProject(jwt, "Thesis");

        mockMvc.perform(post("/api/task-templates")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "name", "Daily Stand-Up",
                        "description", "Morning stand-up meeting",
                        "projectIds", List.of(projectId)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Daily Stand-Up"))
                .andExpect(jsonPath("$.description").value("Morning stand-up meeting"))
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.projects[0].id").value(projectId))
                .andExpect(jsonPath("$.projects[0].name").value("Thesis"))
                .andExpect(jsonPath("$.createdAt").isString());
    }

    @Test
    void createTemplate_withNoDescriptionAndNoProjects_succeeds() throws Exception {
        mockMvc.perform(post("/api/task-templates")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Quick Task"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Quick Task"))
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.projects", hasSize(0)));
    }

    @Test
    void listTemplates_returnsUserTemplatesOnly() throws Exception {
        createTemplate(jwt,      "Stand-Up",    null, null);
        createTemplate(jwt,      "Code Review", null, null);
        createTemplate(otherJwt, "Other Task",  null, null);

        mockMvc.perform(get("/api/task-templates")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("Stand-Up", "Code Review")));
    }

    @Test
    void updateTemplate_changesNameDescriptionAndProjects() throws Exception {
        Long pid = createProject(jwt, "Backend");
        Long tid = createTemplate(jwt, "Old Name", "old desc", null);

        mockMvc.perform(put("/api/task-templates/" + tid)
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "name", "New Name",
                        "description", "new desc",
                        "projectIds", List.of(pid)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Name"))
                .andExpect(jsonPath("$.description").value("new desc"))
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.projects[0].name").value("Backend"));
    }

    @Test
    void deleteTemplate_removesTemplateAndReturns204() throws Exception {
        Long tid = createTemplate(jwt, "ToDelete", null, null);

        mockMvc.perform(delete("/api/task-templates/" + tid)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/task-templates")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void startFromTemplate_createsRunningTaskWithDescriptionAndProjects() throws Exception {
        Long pid = createProject(jwt, "Thesis");
        Long tid = createTemplate(jwt, "Daily Stand-Up", "Morning sync", List.of(pid));

        mockMvc.perform(post("/api/task-templates/" + tid + "/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").value("Morning sync"))
                .andExpect(jsonPath("$.running").value(true))
                .andExpect(jsonPath("$.endTime").doesNotExist())
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.projects[0].name").value("Thesis"));
    }

    @Test
    void startFromTemplate_whileTimerRunning_returns409() throws Exception {
        Long tid = createTemplate(jwt, "Stand-Up", null, null);

        // Start first timer
        mockMvc.perform(post("/api/task-templates/" + tid + "/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isCreated());

        // Attempt second start
        mockMvc.perform(post("/api/task-templates/" + tid + "/start")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void crossUserIsolation_cannotAccessOtherUsersTemplate() throws Exception {
        Long tid = createTemplate(jwt, "Private Template", null, null);

        // Other user tries to update
        mockMvc.perform(put("/api/task-templates/" + tid)
                .header("Authorization", "Bearer " + otherJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Hacked"))))
                .andExpect(status().isNotFound());

        // Other user tries to delete
        mockMvc.perform(delete("/api/task-templates/" + tid)
                .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());

        // Other user tries to start from it
        mockMvc.perform(post("/api/task-templates/" + tid + "/start")
                .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
    }

    @Test
    void projectsPersistedOnTemplate_returnedInListResponse() throws Exception {
        Long p1 = createProject(jwt, "Project A");
        Long p2 = createProject(jwt, "Project B");
        createTemplate(jwt, "Multi-Project Task", "desc", List.of(p1, p2));

        mockMvc.perform(get("/api/task-templates")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].projects", hasSize(2)))
                .andExpect(jsonPath("$[0].projects[*].name",
                        containsInAnyOrder("Project A", "Project B")));
    }

    @Test
    void createTemplate_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/task-templates")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Anon"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createTemplate_blankName_returns400() throws Exception {
        mockMvc.perform(post("/api/task-templates")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", ""))))
                .andExpect(status().isBadRequest());
    }
}
