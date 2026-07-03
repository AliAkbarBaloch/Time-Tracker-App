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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {"app.rate-limit.login-per-minute=2",
        "spring.datasource.url=jdbc:h2:mem:ratelimittest;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"})
class LoginRateLimitTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("ratetest@example.com", "password123", "Rate"))))
                .andExpect(status().isCreated());
    }

    @Test
    void loginWithinLimit_isAllowed() throws Exception {
        LoginRequest req = new LoginRequest("ratetest@example.com", "password123");
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    void loginOverLimit_returns429() throws Exception {
        LoginRequest req = new LoginRequest("ratetest@example.com", "password123");
        String body = objectMapper.writeValueAsString(req);

        // Exhaust the limit (2 allowed)
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body));
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body));

        // Third attempt should be rate-limited
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isTooManyRequests());
    }
}
