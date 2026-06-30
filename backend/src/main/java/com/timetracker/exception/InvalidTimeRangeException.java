package com.timetracker.exception;

public class InvalidTimeRangeException extends RuntimeException {
    public InvalidTimeRangeException(String message) {
        super(message);
    }
}
