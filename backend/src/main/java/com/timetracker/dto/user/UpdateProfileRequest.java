package com.timetracker.dto.user;

/**
 * Request body for PUT /api/users/profile (US-025).
 * Both fields are optional — pass null to leave a field unchanged.
 * timezone must be a valid IANA time-zone identifier; the service validates it
 * with ZoneId.of() and returns 400 on an unrecognised value.
 */
public record UpdateProfileRequest(
        String displayName,
        String timezone
) {}
