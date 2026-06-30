package com.timetracker.controller;

import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse startTask(@AuthenticationPrincipal UserDetails principal,
                                  @RequestBody(required = false) StartTaskRequest request) {
        return taskService.startTask(principal.getUsername(), request);
    }

    @GetMapping("/active")
    public ResponseEntity<TaskResponse> getActiveTask(@AuthenticationPrincipal UserDetails principal) {
        return taskService.getActiveTask(principal.getUsername())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
