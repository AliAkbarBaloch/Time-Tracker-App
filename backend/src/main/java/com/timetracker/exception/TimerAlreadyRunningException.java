package com.timetracker.exception;

public class TimerAlreadyRunningException extends RuntimeException {
    public TimerAlreadyRunningException() {
        super("A timer is already running. Stop it before starting a new one.");
    }
}
