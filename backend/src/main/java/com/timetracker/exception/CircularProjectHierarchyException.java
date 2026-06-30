package com.timetracker.exception;

public class CircularProjectHierarchyException extends RuntimeException {
    public CircularProjectHierarchyException() {
        super("Circular project hierarchy is not allowed.");
    }
}
