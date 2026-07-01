package com.timetracker.controller;

import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.template.CreateTemplateRequest;
import com.timetracker.dto.template.TemplateResponse;
import com.timetracker.dto.template.UpdateTemplateRequest;
import com.timetracker.service.TaskTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-templates")
public class TaskTemplateController {

    private final TaskTemplateService templateService;

    public TaskTemplateController(TaskTemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public List<TemplateResponse> listTemplates(@AuthenticationPrincipal UserDetails principal) {
        return templateService.listTemplates(principal.getUsername());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse createTemplate(@AuthenticationPrincipal UserDetails principal,
                                           @Valid @RequestBody CreateTemplateRequest request) {
        return templateService.createTemplate(principal.getUsername(), request);
    }

    @PutMapping("/{id}")
    public TemplateResponse updateTemplate(@AuthenticationPrincipal UserDetails principal,
                                           @PathVariable Long id,
                                           @Valid @RequestBody UpdateTemplateRequest request) {
        return templateService.updateTemplate(principal.getUsername(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplate(@AuthenticationPrincipal UserDetails principal,
                               @PathVariable Long id) {
        templateService.deleteTemplate(principal.getUsername(), id);
    }

    @PostMapping("/{id}/start")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse startFromTemplate(@AuthenticationPrincipal UserDetails principal,
                                          @PathVariable Long id) {
        return templateService.startFromTemplate(principal.getUsername(), id);
    }
}
