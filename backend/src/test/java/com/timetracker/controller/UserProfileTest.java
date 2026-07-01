package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
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

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for US-025: User Profile — GET and PUT /api/users/profile,
 * timezone field on the User entity, and timezone in the auth response.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserProfileTest {

    @Autowired MockMvc      mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;

    private String jwt;

    // ── Setup ─────────────────────────────────────────────────────────────────

    @BeforeEach
    void setUp() throws Exception {
        userRepository.deleteAll();
        jwt = registerAndLogin("tz@example.com", "TzUser");
    }

    // ── GET /api/users/profile ────────────────────────────────────────────────

    /**
     * AC: GET /api/users/profile returns all profile fields including timezone.
     */
    @Test
    void getProfile_returnsAllFields() throws Exception {
        mockMvc.perform(get("/api/users/profile")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email",       is("tz@example.com")))
                .andExpect(jsonPath("$.displayName", is("TzUser")))
                .andExpect(jsonPath("$.timezone",    is("UTC")))
                .andExpect(jsonPath("$.id",          notNullValue()))
                .andExpect(jsonPath("$.createdAt",   notNullValue()));
    }

    /**
     * AC: Default timezone for a newly registered user is "UTC".
     */
    @Test
    void getProfile_defaultTimezoneIsUtc() throws Exception {
        mockMvc.perform(get("/api/users/profile")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone", is("UTC")));
    }

    /**
     * AC: Unauthenticated request returns 401.
     */
    @Test
    void getProfile_noAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/users/profile"))
                .andExpect(status().isUnauthorized());
    }

    // ── PUT /api/users/profile ────────────────────────────────────────────────

    /**
     * AC: Valid IANA timezone update succeeds and is reflected in the response.
     */
    @Test
    void updateProfile_validTimezone_updatesSuccessfully() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "Europe/Berlin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone", is("Europe/Berlin")));
    }

    /**
     * AC: After updating timezone, GET profile reflects the new value.
     */
    @Test
    void updateProfile_persistsTimezone() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "America/New_York"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/users/profile")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone", is("America/New_York")));
    }

    /**
     * AC: Invalid (unrecognised) IANA timezone returns 400.
     */
    @Test
    void updateProfile_invalidTimezone_returns400() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "Not/ATimezone"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Not/ATimezone")));
    }

    /**
     * AC: A completely made-up string returns 400.
     */
    @Test
    void updateProfile_bogusTimezone_returns400() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "banana"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", notNullValue()));
    }

    /**
     * AC: displayName can be updated via PUT /api/users/profile without touching timezone.
     */
    @Test
    void updateProfile_displayNameOnly_updatesDisplayName() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("displayName", "Updated Name"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName", is("Updated Name")))
                .andExpect(jsonPath("$.timezone",    is("UTC")));  // unchanged
    }

    /**
     * AC: displayName and timezone can be updated in the same request.
     */
    @Test
    void updateProfile_bothFields_updatesAll() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        Map.of("displayName", "New Name", "timezone", "Asia/Tokyo"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName", is("New Name")))
                .andExpect(jsonPath("$.timezone",    is("Asia/Tokyo")));
    }

    /**
     * AC: Login response includes the user's current timezone.
     */
    @Test
    void loginResponse_includesTimezone() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("tz@example.com", "password123"))))
                .andExpect(status().isOk())
                .andReturn();

        String tz = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("timezone").asText();
        org.assertj.core.api.Assertions.assertThat(tz).isEqualTo("UTC");
    }

    /**
     * AC: Register response includes the default timezone "UTC".
     */
    @Test
    void registerResponse_includesDefaultUtcTimezone() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("new@example.com", "password123", "NewUser"))))
                .andExpect(status().isCreated())
                .andReturn();

        String tz = objectMapper.readTree(r.getResponse().getContentAsString())
                .get("timezone").asText();
        org.assertj.core.api.Assertions.assertThat(tz).isEqualTo("UTC");
    }

    /**
     * AC: Changing timezone does not affect stored UTC timestamps — only display changes.
     * Verified by checking that the user's profile timezone changes but createdAt stays the same.
     */
    @Test
    void updateTimezone_doesNotAffectCreatedAt() throws Exception {
        // Get original createdAt
        MvcResult before = mockMvc.perform(get("/api/users/profile")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andReturn();
        String originalCreatedAt = objectMapper.readTree(before.getResponse().getContentAsString())
                .get("createdAt").asText();

        // Update timezone
        mockMvc.perform(put("/api/users/profile")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "Pacific/Auckland"))))
                .andExpect(status().isOk());

        // createdAt must not change
        mockMvc.perform(get("/api/users/profile")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdAt", is(originalCreatedAt)));
    }

    /**
     * AC: Unauthenticated PUT returns 401.
     */
    @Test
    void updateProfile_noAuth_returns401() throws Exception {
        mockMvc.perform(put("/api/users/profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("timezone", "UTC"))))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String registerAndLogin(String email, String displayName) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest(email, "password123", displayName))))
                .andExpect(status().isCreated());
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest(email, "password123"))))
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }
}
