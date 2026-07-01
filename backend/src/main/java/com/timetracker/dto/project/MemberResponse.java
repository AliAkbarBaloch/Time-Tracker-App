package com.timetracker.dto.project;

import com.timetracker.entity.ProjectMember;

import java.time.Instant;

/**
 * Response DTO returned by GET /api/projects/{id}/members and
 * POST /api/projects/{id}/members (the newly created membership).
 */
public record MemberResponse(
        Long userId,
        String email,
        String displayName,
        String role,       // "OWNER" or "MEMBER"
        Instant joinedAt
) {
    /** Convenience factory so the service layer doesn't need to unpack the entity manually. */
    public static MemberResponse from(ProjectMember member) {
        return new MemberResponse(
                member.getUser().getId(),
                member.getUser().getEmail(),
                member.getUser().getDisplayName(),
                member.getRole().name(),
                member.getJoinedAt()
        );
    }
}
