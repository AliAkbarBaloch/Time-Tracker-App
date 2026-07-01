package com.timetracker.service;

import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.InviteMemberRequest;
import com.timetracker.dto.project.MemberResponse;
import com.timetracker.dto.project.ProjectResponse;
import com.timetracker.dto.project.ProjectSummaryResponse;
import com.timetracker.dto.project.UpdateProjectRequest;
import com.timetracker.entity.Project;
import com.timetracker.entity.ProjectMember;
import com.timetracker.entity.ProjectMemberRole;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.CannotRemoveOwnerException;
import com.timetracker.exception.CircularProjectHierarchyException;
import com.timetracker.exception.MemberAlreadyInvitedException;
import com.timetracker.exception.MemberNotFoundException;
import com.timetracker.exception.ProjectHasAssociationsException;
import com.timetracker.exception.ProjectNameAlreadyExistsException;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.repository.ProjectMemberRepository;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository,
                          ProjectMemberRepository memberRepository,
                          UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.memberRepository  = memberRepository;
        this.userRepository    = userRepository;
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    @Transactional
    public ProjectResponse createProject(String userEmail, CreateProjectRequest request) {
        User user = loadUser(userEmail);

        // Name must be unique across all projects the user owns
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

        Project saved = projectRepository.save(project);

        // Every newly created project gets an OWNER membership row immediately.
        // This replaces the seeder logic for new projects going forward.
        ProjectMember ownerMembership = new ProjectMember();
        ownerMembership.setProject(saved);
        ownerMembership.setUser(user);
        ownerMembership.setRole(ProjectMemberRole.OWNER);
        memberRepository.save(ownerMembership);

        return ProjectResponse.from(saved);
    }

    @Transactional
    public ProjectResponse updateProject(String userEmail, Long projectId, UpdateProjectRequest request) {
        User user = loadUser(userEmail);
        // Only the OWNER (project.user) can edit — use strict owner check
        Project project = projectRepository.findByIdAndUser(projectId, user)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        boolean nameConflict = projectRepository.findByUser(user).stream()
                .anyMatch(p -> !projectId.equals(p.getId()) && p.getName().equalsIgnoreCase(request.name()));
        if (nameConflict) {
            throw new ProjectNameAlreadyExistsException(request.name());
        }

        project.setName(request.name());
        project.setDescription(request.description());
        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public void deleteProject(String userEmail, Long projectId, boolean force) {
        User user = loadUser(userEmail);
        // Only the OWNER can delete the project
        Project project = projectRepository.findByIdAndUser(projectId, user)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        long taskCount = project.getTasks().size();
        long subCount  = project.getSubprojects().size();

        if (!force && (taskCount > 0 || subCount > 0)) {
            throw new ProjectHasAssociationsException(taskCount, subCount);
        }

        disassociateTasksRecursively(project);
        // Membership rows are deleted via orphanRemoval on Project.members
        projectRepository.delete(project);
    }

    /**
     * Returns all root-level projects visible to the user — both owned and shared.
     * Each response carries the `shared` flag so the frontend can show a badge.
     */
    public List<ProjectResponse> listProjects(String userEmail) {
        User user = loadUser(userEmail);
        return projectRepository.findRootProjectsByMember(user).stream()
                .map(p -> {
                    // Determine whether this user is a MEMBER (not OWNER) for this project
                    boolean isShared = !p.getUser().equals(user);
                    return ProjectResponse.from(p, isShared);
                })
                .toList();
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ProjectSummaryResponse getProjectSummary(String userEmail, Long projectId,
                                                     Instant from, Instant to) {
        User user = loadUser(userEmail);
        // Any member (OWNER or MEMBER) can view the summary
        Project project = projectRepository.findByIdAndMember(projectId, user)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        // Rolled-up total for the entire subtree, deduplicated across all descendants
        Set<Long> globalSeen = new HashSet<>();
        long totalSeconds = calcSubtreeSeconds(project, from, to, globalSeen);

        // Collect all unique tasks across the entire subtree, sorted by startTime
        Set<Long> taskSeen = new HashSet<>();
        List<ProjectSummaryResponse.TaskSummary> allTasks = new ArrayList<>();
        collectSubtreeTasks(project, from, to, taskSeen, allTasks);
        allTasks.sort(Comparator.comparing(ProjectSummaryResponse.TaskSummary::startTime));

        // Individual total per direct subproject (each uses its own seen set)
        List<ProjectSummaryResponse.SubprojectSummary> subSummaries = project.getSubprojects()
                .stream()
                .map(sub -> {
                    Set<Long> subSeen = new HashSet<>();
                    long subTotal = calcSubtreeSeconds(sub, from, to, subSeen);
                    return new ProjectSummaryResponse.SubprojectSummary(sub.getId(), sub.getName(), subTotal);
                })
                .toList();

        Long parentId = project.getParent() != null ? project.getParent().getId() : null;
        return new ProjectSummaryResponse(project.getId(), project.getName(),
                project.getDescription(), parentId, totalSeconds, subSummaries, allTasks);
    }

    // ── Member management (US-022) ────────────────────────────────────────────

    /**
     * Invite a registered user to collaborate on this project.
     * Only the project OWNER can send invites.
     * Returns 404 if the email is unknown, 409 if already a member.
     */
    @Transactional
    public MemberResponse inviteMember(String ownerEmail, Long projectId, InviteMemberRequest request) {
        User owner = loadUser(ownerEmail);
        // Invitation requires OWNER role — use strict owner query
        Project project = projectRepository.findByIdAndUser(projectId, owner)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        // Look up the invitee by email; 404 if not registered
        User invitee = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No registered user found with email: " + request.email()));

        // Prevent duplicate memberships
        if (memberRepository.existsByProjectAndUser(project, invitee)) {
            throw new MemberAlreadyInvitedException(request.email());
        }

        ProjectMember membership = new ProjectMember();
        membership.setProject(project);
        membership.setUser(invitee);
        membership.setRole(ProjectMemberRole.MEMBER);
        return MemberResponse.from(memberRepository.save(membership));
    }

    /**
     * Remove a member from a project.
     * Only the project OWNER can remove members. The owner cannot remove themselves.
     */
    @Transactional
    public void removeMember(String ownerEmail, Long projectId, Long targetUserId) {
        User owner = loadUser(ownerEmail);
        Project project = projectRepository.findByIdAndUser(projectId, owner)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        // Guard: owner cannot remove themselves
        if (owner.getId().equals(targetUserId)) {
            throw new CannotRemoveOwnerException();
        }

        // Find the membership row for the target user
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new MemberNotFoundException(targetUserId));
        ProjectMember membership = memberRepository.findByProjectAndUser(project, targetUser)
                .orElseThrow(() -> new MemberNotFoundException(targetUserId));

        memberRepository.delete(membership);
    }

    /**
     * List all members of a project (name, email, role).
     * Accessible to any member (OWNER or MEMBER).
     */
    @Transactional(readOnly = true)
    public List<MemberResponse> listMembers(String userEmail, Long projectId) {
        User user = loadUser(userEmail);
        // Any member can view the members list
        Project project = projectRepository.findByIdAndMember(projectId, user)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        return memberRepository.findByProject(project).stream()
                .map(MemberResponse::from)
                .sorted(Comparator.comparing(MemberResponse::role)  // MEMBER < OWNER alphabetically
                        .thenComparing(MemberResponse::displayName))
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void disassociateTasksRecursively(Project project) {
        for (Task task : new HashSet<>(project.getTasks())) {
            task.getProjects().remove(project);
        }
        for (Project sub : project.getSubprojects()) {
            disassociateTasksRecursively(sub);
        }
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

    private long calcSubtreeSeconds(Project project, Instant from, Instant to, Set<Long> seen) {
        long total = 0;
        for (Task task : project.getTasks()) {
            if (isInRange(task, from, to) && seen.add(task.getId()) && task.getEndTime() != null) {
                total += task.getEndTime().getEpochSecond() - task.getStartTime().getEpochSecond();
            }
        }
        for (Project sub : project.getSubprojects()) {
            total += calcSubtreeSeconds(sub, from, to, seen);
        }
        return total;
    }

    private void collectSubtreeTasks(Project project, Instant from, Instant to,
                                      Set<Long> seen, List<ProjectSummaryResponse.TaskSummary> tasks) {
        for (Task task : project.getTasks()) {
            if (isInRange(task, from, to) && seen.add(task.getId())) {
                tasks.add(new ProjectSummaryResponse.TaskSummary(
                        task.getId(), task.getDescription(),
                        task.getStartTime(), task.getEndTime(), task.isRunning()));
            }
        }
        for (Project sub : project.getSubprojects()) {
            collectSubtreeTasks(sub, from, to, seen, tasks);
        }
    }

    private boolean isInRange(Task task, Instant from, Instant to) {
        if (from != null && task.getStartTime().isBefore(from)) return false;
        if (to != null && !task.getStartTime().isBefore(to)) return false;
        return true;
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
