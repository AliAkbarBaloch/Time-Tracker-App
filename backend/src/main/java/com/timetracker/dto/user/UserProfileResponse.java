package com.timetracker.dto.user;

import com.timetracker.entity.User;

import java.time.Instant;

/** Response body for GET and PUT /api/users/profile (US-025). */
public record UserProfileResponse(
        Long    id,
        String  email,
        String  displayName,
        String  timezone,
        Instant createdAt
) {
    public static UserProfileResponse from(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getTimezone(),
                user.getCreatedAt()
        );
    }
}
