package com.timetracker.exception;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        Map<String, Object> body = new HashMap<>();
        body.put("status", 400);
        body.put("errors", fieldErrors);
        return body;
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, Object> handleEmailExists(EmailAlreadyExistsException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", 409);
        body.put("message", ex.getMessage());
        return body;
    }

    @ExceptionHandler(BadCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Map<String, Object> handleBadCredentials(BadCredentialsException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", 401);
        body.put("message", "Invalid email or password");
        return body;
    }

    @ExceptionHandler(TimerAlreadyRunningException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, Object> handleTimerAlreadyRunning(TimerAlreadyRunningException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", 409);
        body.put("message", ex.getMessage());
        return body;
    }
}
