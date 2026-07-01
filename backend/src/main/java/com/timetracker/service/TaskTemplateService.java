package com.timetracker.service;

import com.timetracker.dto.task.StartTaskRequest;
import com.timetracker.dto.task.TaskResponse;
import com.timetracker.dto.template.CreateTemplateRequest;
import com.timetracker.dto.template.TemplateResponse;
import com.timetracker.dto.template.UpdateTemplateRequest;
import com.timetracker.entity.Project;
import com.timetracker.entity.TaskTemplate;
import com.timetracker.entity.User;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.exception.TemplateNotFoundException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskTemplateRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TaskTemplateService {

    private final TaskTemplateRepository templateRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final TaskService taskService;

    public TaskTemplateService(TaskTemplateRepository templateRepository,
                               UserRepository userRepository,
                               ProjectRepository projectRepository,
                               TaskService taskService) {
        this.templateRepository = templateRepository;
        this.userRepository     = userRepository;
        this.projectRepository  = projectRepository;
        this.taskService        = taskService;
    }

    @Transactional
    public TemplateResponse createTemplate(String userEmail, CreateTemplateRequest request) {
        User user = loadUser(userEmail);
        Set<Project> projects = resolveProjects(request.projectIds(), user);

        TaskTemplate template = new TaskTemplate();
        template.setUser(user);
        template.setName(request.name());
        template.setDescription(request.description());
        template.setProjects(projects);

        return TemplateResponse.from(templateRepository.save(template));
    }

    @Transactional(readOnly = true)
    public List<TemplateResponse> listTemplates(String userEmail) {
        User user = loadUser(userEmail);
        return templateRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .map(TemplateResponse::from)
                .toList();
    }

    @Transactional
    public TemplateResponse updateTemplate(String userEmail, Long templateId, UpdateTemplateRequest request) {
        User user = loadUser(userEmail);
        TaskTemplate template = templateRepository.findByIdAndUser(templateId, user)
                .orElseThrow(() -> new TemplateNotFoundException(templateId));

        Set<Project> projects = resolveProjects(request.projectIds(), user);
        template.setName(request.name());
        template.setDescription(request.description());
        template.setProjects(projects);

        return TemplateResponse.from(templateRepository.save(template));
    }

    @Transactional
    public void deleteTemplate(String userEmail, Long templateId) {
        User user = loadUser(userEmail);
        TaskTemplate template = templateRepository.findByIdAndUser(templateId, user)
                .orElseThrow(() -> new TemplateNotFoundException(templateId));
        template.getProjects().clear();
        templateRepository.delete(template);
    }

    @Transactional
    public TaskResponse startFromTemplate(String userEmail, Long templateId) {
        User user = loadUser(userEmail);
        TaskTemplate template = templateRepository.findByIdAndUser(templateId, user)
                .orElseThrow(() -> new TemplateNotFoundException(templateId));

        List<Long> projectIds = template.getProjects().stream()
                .map(Project::getId)
                .toList();

        return taskService.startTask(userEmail, new StartTaskRequest(template.getDescription()), projectIds);
    }

    private Set<Project> resolveProjects(List<Long> projectIds, User user) {
        Set<Project> projects = new HashSet<>();
        if (projectIds != null) {
            for (Long pid : projectIds) {
                Project p = projectRepository.findByIdAndMember(pid, user)
                        .orElseThrow(() -> new ProjectNotFoundException(pid));
                projects.add(p);
            }
        }
        return projects;
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
