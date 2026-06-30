package com.timetracker.exception;

public class ProjectNameAlreadyExistsException extends RuntimeException {
    public ProjectNameAlreadyExistsException(String name) {
        super("A project named \"" + name + "\" already exists.");
    }
}
