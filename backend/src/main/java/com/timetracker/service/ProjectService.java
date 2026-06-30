package com.timetracker.service;

import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.ProjectResponse;
import com.timetracker.entity.Project;
import com.timetracker.entity.User;
import com.timetracker.exception.CircularProjectHierarchyException;
import com.timetracker.exception.ProjectNameAlreadyExistsException;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository, UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ProjectResponse createProject(String userEmail, CreateProjectRequest request) {
        User user = loadUser(userEmail);

        boolean nameExists = projectRepository.findByUser(user).stream()
                .anyMatch(p -> p.getName().equalsIgnoreCase(request.name()));
        if (nameExists) {
            throw new ProjectNameAlreadyExistsException(request.name());
        }

        Project project = new Project();
        project.setUser(user);
        project.setName(request.name());
        project.setDescription(request.description());

        if (request.parentProjectId() != null) {
            Project parent = projectRepository.findByIdAndUser(request.parentProjectId(), user)
                    .orElseThrow(() -> new ProjectNotFoundException(request.parentProjectId()));
            guardAgainstCircularHierarchy(project, parent);
            project.setParent(parent);
        }

        return ProjectResponse.from(projectRepository.save(project));
    }

    public List<ProjectResponse> listProjects(String userEmail) {
        User user = loadUser(userEmail);
        return projectRepository.findByUserAndParentIsNull(user).stream()
                .map(ProjectResponse::from)
                .toList();
    }

    private void guardAgainstCircularHierarchy(Project project, Project candidate) {
        Project cursor = candidate;
        while (cursor != null) {
            if (project.getId() != null && project.getId().equals(cursor.getId())) {
                throw new CircularProjectHierarchyException();
            }
            cursor = cursor.getParent();
        }
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
