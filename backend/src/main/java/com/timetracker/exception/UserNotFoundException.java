package com.timetracker.exception;

/**
 * Thrown when an invite target email is not registered in the system (HTTP 404).
 * Uses a plain RuntimeException (not Spring Security's UsernameNotFoundException)
 * so that the GlobalExceptionHandler can map it to 404 without Security intercepting it.
 */
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String email) {
        super("No registered user found with email: " + email);
    }
}
