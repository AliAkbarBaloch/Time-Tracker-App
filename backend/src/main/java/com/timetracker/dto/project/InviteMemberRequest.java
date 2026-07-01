package com.timetracker.dto.project;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Request body for POST /api/projects/{id}/members.
 * The invitee is identified by their registered email address.
 */
public record InviteMemberRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Must be a valid email address")
        String email
) {}
