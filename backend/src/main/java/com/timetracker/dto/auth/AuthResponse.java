package com.timetracker.dto.auth;

/**
 * Returned by login and register endpoints.
 * timezone is included so the frontend can apply the correct display zone immediately (US-025).
 */
public record AuthResponse(
        String token,
        String email,
        String displayName,
        String timezone
) {}
