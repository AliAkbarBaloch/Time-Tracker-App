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
import com.timetracker.exception.UserNotFoundException;
import com.timetracker.repository.ProjectMemberRepository;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
        project.setBudgetHours(request.budgetHours());

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
        project.setBudgetHours(request.budgetHours());
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

    /**
     * Returns the project summary including a per-user contribution breakdown.
     *
     * When filterUserId is provided (US-023):
     *  - tasks and totalSeconds are scoped to that user's entries only
     *  - the target user must be a project member; otherwise 403
     *  - contributions always reflects ALL members (needed for the dropdown)
     */
    @Transactional(readOnly = true)
    public ProjectSummaryResponse getProjectSummary(String userEmail, Long projectId,
                                                     Instant from, Instant to, Long filterUserId) {
        User user = loadUser(userEmail);
        // Any member (OWNER or MEMBER) can view the summary
        Project project = projectRepository.findByIdAndMember(projectId, user)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        // Validate the optional userId filter — the target must also be a project member
        if (filterUserId != null) {
            User filterUser = userRepository.findById(filterUserId)
                    .orElseThrow(() -> new AccessDeniedException("User is not a member of this project."));
            if (!memberRepository.existsByProjectAndUser(project, filterUser)) {
                throw new AccessDeniedException("User is not a member of this project.");
            }
        }

        // Collect all unique task entities across the subtree (global deduplication)
        Set<Long> taskSeen = new HashSet<>();
        List<Task> allUniqueTasks = new ArrayList<>();
        collectSubtreeTaskEntities(project, from, to, taskSeen, allUniqueTasks);

        // Apply user filter for the task list and totalSeconds
        List<Task> filteredTasks = filterUserId != null
                ? allUniqueTasks.stream()
                        .filter(t -> t.getUser().getId().equals(filterUserId))
                        .collect(Collectors.toCollection(ArrayList::new))
                : allUniqueTasks;

        // Total seconds (filtered when userId param present, combined otherwise)
        long totalSeconds = filteredTasks.stream()
                .filter(t -> t.getEndTime() != null)
                .mapToLong(t -> t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond())
                .sum();

        // Task summaries with owner info, sorted by startTime
        List<ProjectSummaryResponse.TaskSummary> taskSummaries = filteredTasks.stream()
                .sorted(Comparator.comparing(Task::getStartTime))
                .map(t -> new ProjectSummaryResponse.TaskSummary(
                        t.getId(), t.getDescription(),
                        t.getStartTime(), t.getEndTime(), t.isRunning(),
                        t.getUser().getId(), t.getUser().getDisplayName()))
                .toList();

        // Per-user contributions from ALL tasks (not filtered) — always returned so
        // the frontend dropdown works even when a userId filter is active
        Map<User, Long> userTotals = allUniqueTasks.stream()
                .filter(t -> t.getEndTime() != null)
                .collect(Collectors.groupingBy(
                        Task::getUser,
                        Collectors.summingLong(t ->
                                t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond())));
        List<ProjectSummaryResponse.UserContribution> contributions = userTotals.entrySet().stream()
                .map(e -> new ProjectSummaryResponse.UserContribution(
                        e.getKey().getId(), e.getKey().getDisplayName(), e.getValue()))
                .sorted(Comparator.comparingLong(ProjectSummaryResponse.UserContribution::totalSeconds).reversed())
                .toList();

        // Individual total per direct subproject (each uses its own seen set, unfiltered)
        List<ProjectSummaryResponse.SubprojectSummary> subSummaries = project.getSubprojects()
                .stream()
                .map(sub -> {
                    Set<Long> subSeen = new HashSet<>();
                    long subTotal = calcSubtreeSeconds(sub, from, to, subSeen);
                    return new ProjectSummaryResponse.SubprojectSummary(sub.getId(), sub.getName(), subTotal);
                })
                .toList();

        Long parentId = project.getParent() != null ? project.getParent().getId() : null;

        // Budget fields (US-026): computed from all-time total across all members (no date filter)
        Set<Long> budgetSeen = new HashSet<>();
        List<Task> allTimeTasks = new ArrayList<>();
        collectSubtreeTaskEntities(project, null, null, budgetSeen, allTimeTasks);
        long allTimeTotalSeconds = allTimeTasks.stream()
                .filter(t -> t.getEndTime() != null)
                .mapToLong(t -> t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond())
                .sum();
        Double budgetHours  = project.getBudgetHours();
        Double usedHours    = allTimeTotalSeconds / 3600.0;
        Double budgetPercent = budgetHours != null && budgetHours > 0
                ? (usedHours / budgetHours * 100.0) : null;
        String budgetStatus = computeBudgetStatus(budgetHours, usedHours);

        return new ProjectSummaryResponse(project.getId(), project.getName(),
                project.getDescription(), parentId, totalSeconds, subSummaries, taskSummaries, contributions,
                budgetHours, usedHours, budgetPercent, budgetStatus);
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
        // UserNotFoundException (not UsernameNotFoundException) avoids Spring Security intercepting it as 401
        User invitee = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new UserNotFoundException(request.email()));

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

    /**
     * Recursively collects unique Task entities across the project subtree.
     * Deduplication is handled by the seen set (task IDs already added are skipped).
     * Returns raw entities so the caller can apply user-filtering and map to DTOs.
     */
    private void collectSubtreeTaskEntities(Project project, Instant from, Instant to,
                                             Set<Long> seen, List<Task> tasks) {
        for (Task task : project.getTasks()) {
            if (isInRange(task, from, to) && seen.add(task.getId())) {
                tasks.add(task);
            }
        }
        for (Project sub : project.getSubprojects()) {
            collectSubtreeTaskEntities(sub, from, to, seen, tasks);
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

    /**
     * Derives the budget status string from budgetHours and usedHours.
     * Returns null when no budget is set.
     *   < 80% used  → ON_TRACK
     *   80–99% used → WARNING
     *   ≥ 100% used → OVER_BUDGET
     */
    static String computeBudgetStatus(Double budgetHours, Double usedHours) {
        if (budgetHours == null || budgetHours <= 0) return null;
        double ratio = usedHours / budgetHours;
        if (ratio >= 1.0) return "OVER_BUDGET";
        if (ratio >= 0.8) return "WARNING";
        return "ON_TRACK";
    }
}
