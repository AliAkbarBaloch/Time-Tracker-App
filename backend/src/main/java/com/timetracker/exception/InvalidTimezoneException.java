package com.timetracker.exception;

/** Thrown when a caller supplies an unrecognised IANA timezone identifier. */
public class InvalidTimezoneException extends RuntimeException {
    public InvalidTimezoneException(String timezone) {
        super("Unknown or invalid timezone: \"" + timezone + "\". Use a valid IANA timezone ID (e.g. \"Europe/Berlin\").");
    }
}
