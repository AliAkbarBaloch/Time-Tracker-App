package com.timetracker.controller;

import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse createTask(@AuthenticationPrincipal UserDetails principal,
                                   @Valid @RequestBody CreateTaskRequest request) {
        return taskService.createTask(principal.getUsername(), request);
    }

    @GetMapping
    public List<TaskResponse> listTasks(@AuthenticationPrincipal UserDetails principal) {
        return taskService.listTasks(principal.getUsername());
    }

    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse startTask(@AuthenticationPrincipal UserDetails principal,
                                  @RequestBody(required = false) StartTaskRequest request) {
        return taskService.startTask(principal.getUsername(), request);
    }

    @PostMapping("/stop")
    public TaskResponse stopTask(@AuthenticationPrincipal UserDetails principal) {
        return taskService.stopTask(principal.getUsername());
    }

    @GetMapping("/active")
    public ResponseEntity<TaskResponse> getActiveTask(@AuthenticationPrincipal UserDetails principal) {
        return taskService.getActiveTask(principal.getUsername())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
