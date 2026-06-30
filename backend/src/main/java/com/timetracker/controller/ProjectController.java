package com.timetracker.controller;

import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.ProjectResponse;
import com.timetracker.dto.project.UpdateProjectRequest;
import com.timetracker.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse createProject(@AuthenticationPrincipal UserDetails principal,
                                         @Valid @RequestBody CreateProjectRequest request) {
        return projectService.createProject(principal.getUsername(), request);
    }

    @GetMapping
    public List<ProjectResponse> listProjects(@AuthenticationPrincipal UserDetails principal) {
        return projectService.listProjects(principal.getUsername());
    }

    @PutMapping("/{id}")
    public ProjectResponse updateProject(@AuthenticationPrincipal UserDetails principal,
                                         @PathVariable Long id,
                                         @Valid @RequestBody UpdateProjectRequest request) {
        return projectService.updateProject(principal.getUsername(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProject(@AuthenticationPrincipal UserDetails principal,
                              @PathVariable Long id,
                              @RequestParam(defaultValue = "false") boolean force) {
        projectService.deleteProject(principal.getUsername(), id, force);
    }
}
