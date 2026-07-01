package com.timetracker.exception;

/** Thrown when an invite is attempted for a user who is already a member (HTTP 409). */
public class MemberAlreadyInvitedException extends RuntimeException {
    public MemberAlreadyInvitedException(String email) {
        super("User '" + email + "' is already a member of this project.");
    }
}
