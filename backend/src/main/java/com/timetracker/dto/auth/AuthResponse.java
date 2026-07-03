package com.timetracker.dto.auth;

/**
 * Returned by login, register, and token-refresh endpoints.
 * timezone is included so the frontend can apply the correct display zone immediately (US-025).
 * refreshToken enables silent token renewal without re-authentication.
 */
public record AuthResponse(
        String token,
        String refreshToken,
        String email,
        String displayName,
        String timezone
) {}
