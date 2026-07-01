package com.timetracker.exception;

/** Thrown when an owner tries to remove themselves from a project (HTTP 400). */
public class CannotRemoveOwnerException extends RuntimeException {
    public CannotRemoveOwnerException() {
        super("The project owner cannot be removed from the project.");
    }
}
