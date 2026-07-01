package com.timetracker.exception;

/** Thrown when a user ID is not found in a project's member list (HTTP 404). */
public class MemberNotFoundException extends RuntimeException {
    public MemberNotFoundException(Long userId) {
        super("User " + userId + " is not a member of this project.");
    }
}
