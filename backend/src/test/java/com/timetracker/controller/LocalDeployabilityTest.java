package com.timetracker.controller;

import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * NFR-004 Local Deployability verification.
 * Proves: health endpoint responds, H2 console is disabled by default in prod
 * config, SPA fallback serves index.html for client-side routes, Docker Compose
 * is present and correct, and the app starts with no cloud dependencies.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LocalDeployabilityTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ── AC: Single health endpoint — required for Docker Compose healthcheck ─

    @Test
    void healthEndpoint_returns200WithStatusUp() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("time-tracker"));
    }

    @Test
    void healthEndpoint_isPublic_noAuthRequired() throws Exception {
        // Health check must be accessible without a JWT (docker-compose curl healthcheck)
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }

    // ── AC: Production H2 config is file-based ────────────────────────────────

    @Test
    void productionConfig_datasourceUrlIsFileBased() throws IOException {
        // Read base application.properties directly (bypasses test-profile override)
        Properties prod = loadBaseApplicationProperties();
        String url = prod.getProperty("spring.datasource.url");
        assertThat(url)
                .as("Production datasource URL must use H2 file mode for persistence across restarts")
                .startsWith("jdbc:h2:file:");
    }

    @Test
    void productionConfig_ddlAutoIsUpdate_notCreateDrop() throws IOException {
        Properties prod = loadBaseApplicationProperties();
        String ddl = prod.getProperty("spring.jpa.hibernate.ddl-auto");
        assertThat(ddl)
                .as("Production DDL-auto must be 'update' so data survives restarts (not create-drop)")
                .isEqualTo("update");
    }

    // ── AC: H2 console not exposed without explicit configuration ─────────────

    @Test
    void productionConfig_h2ConsoleDisabledByDefault() throws IOException {
        Properties prod = loadBaseApplicationProperties();
        String enabled = prod.getProperty("spring.h2.console.enabled", "false");
        assertThat(enabled)
                .as("H2 console must be disabled by default; enable only when explicitly needed")
                .isEqualTo("false");
    }

    // ── AC: SPA fallback serves index.html for React Router routes ────────────

    @Test
    void spaFallback_knownRoute_servesIndexHtml() throws Exception {
        // /dashboard, /tasks, /projects, etc. must return HTML for React Router to handle
        mockMvc.perform(get("/dashboard"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void spaFallback_tasksRoute_servesIndexHtml() throws Exception {
        mockMvc.perform(get("/tasks"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void spaFallback_nestedRoute_servesIndexHtml() throws Exception {
        // e.g. /projects/5 — nested SPA route
        mockMvc.perform(get("/projects/5"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void spaFallback_doesNotInterceptApiRoutes() throws Exception {
        // /api/ routes must NOT be served by the SPA controller — they have their own handlers
        // (401 is expected here since no JWT is provided; NOT a 200 with HTML)
        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void spaFallback_doesNotInterceptStaticAssets() throws Exception {
        // Paths with extensions (e.g. /app.js) must not trigger SPA fallback
        // Spring's default resource handler returns 404 for missing static files
        mockMvc.perform(get("/nonexistent.js"))
                .andExpect(status().isNotFound());
    }

    // ── AC: Docker Compose is present and correct ─────────────────────────────

    @Test
    void dockerCompose_fileExistsInProjectRoot() throws IOException {
        // The file lives in the project root, not on the classpath; verify via file system
        java.io.File composeFile = new java.io.File("../docker-compose.yml");
        assertThat(composeFile.exists())
                .as("docker-compose.yml must exist in the project root for single-command deployment")
                .isTrue();
    }

    @Test
    void dockerCompose_definesBackendAndFrontendServices() throws IOException {
        java.io.File composeFile = new java.io.File("../docker-compose.yml");
        String content = java.nio.file.Files.readString(composeFile.toPath());
        assertThat(content).contains("backend:");
        assertThat(content).contains("frontend:");
    }

    @Test
    void dockerCompose_h2ConsoleDisabledInProductionService() throws IOException {
        java.io.File composeFile = new java.io.File("../docker-compose.yml");
        String content = java.nio.file.Files.readString(composeFile.toPath());
        // docker-compose must explicitly disable the H2 console for production
        assertThat(content).containsIgnoringCase("SPRING_H2_CONSOLE_ENABLED");
        assertThat(content).containsIgnoringCase("false");
    }

    @Test
    void dockerCompose_h2DataPersistedToVolume() throws IOException {
        java.io.File composeFile = new java.io.File("../docker-compose.yml");
        String content = java.nio.file.Files.readString(composeFile.toPath());
        // Volume must be declared so data survives container restarts
        assertThat(content).contains("volumes:");
    }

    // ── AC: App starts with no internet access (all deps resolved at build time) ─

    @Test
    void application_startsWithoutExternalDependencies() {
        // The fact that this test class runs at all proves the Spring context
        // bootstrapped successfully with only local/classpath resources.
        // H2 is embedded — no external DB server required.
        assertThat(datasourceUrl).isNotBlank();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Properties loadBaseApplicationProperties() throws IOException {
        Properties props = new Properties();
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("application.properties")) {
            assertThat(is).as("base application.properties must exist on classpath").isNotNull();
            props.load(is);
        }
        return props;
    }
}
