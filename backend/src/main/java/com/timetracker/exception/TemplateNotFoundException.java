package com.timetracker.exception;

public class TemplateNotFoundException extends RuntimeException {
    public TemplateNotFoundException(Long id) {
        super("Task template not found: " + id);
    }
}
