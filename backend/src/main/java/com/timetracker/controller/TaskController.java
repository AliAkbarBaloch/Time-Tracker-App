package com.timetracker.controller;

import com.timetracker.dto.task.CreateTaskRequest;
import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.task.UpdateTaskRequest;
import com.timetracker.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
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

    /**
     * List tasks with optional filters.
     * When userId is provided it must be combined with projectId; both the caller
     * and the target user must be project members — otherwise 403 is returned (US-023).
     */
    @GetMapping
    public List<TaskResponse> listTasks(@AuthenticationPrincipal UserDetails principal,
                                        @RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to,
                                        @RequestParam(required = false) String search,
                                        @RequestParam(required = false) Long projectId,
                                        @RequestParam(required = false) Long userId) {
        Instant fromInstant = from != null ? Instant.parse(from) : null;
        Instant toInstant   = to   != null ? Instant.parse(to)   : null;
        return taskService.listTasks(principal.getUsername(), fromInstant, toInstant, search, projectId, userId);
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

    @PutMapping("/{id}")
    public TaskResponse updateTask(@AuthenticationPrincipal UserDetails principal,
                                   @PathVariable Long id,
                                   @Valid @RequestBody UpdateTaskRequest request) {
        return taskService.updateTask(principal.getUsername(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(@AuthenticationPrincipal UserDetails principal,
                           @PathVariable Long id) {
        taskService.deleteTask(principal.getUsername(), id);
    }

    @GetMapping("/active")
    public ResponseEntity<TaskResponse> getActiveTask(@AuthenticationPrincipal UserDetails principal) {
        return taskService.getActiveTask(principal.getUsername())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
