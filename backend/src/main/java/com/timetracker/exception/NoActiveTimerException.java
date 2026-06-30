package com.timetracker.exception;

public class NoActiveTimerException extends RuntimeException {
    public NoActiveTimerException() {
        super("No timer is currently running.");
    }
}
