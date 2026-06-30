package com.timetracker.dto.auth;

public record AuthResponse(
        String token,
        String email,
        String displayName
) {}
