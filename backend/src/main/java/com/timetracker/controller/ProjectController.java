package com.timetracker.controller;

import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.project.InviteMemberRequest;
import com.timetracker.dto.project.MemberResponse;
import com.timetracker.dto.project.ProjectResponse;
import com.timetracker.dto.project.ProjectSummaryResponse;
import com.timetracker.dto.project.UpdateProjectRequest;
import com.timetracker.service.ProjectExportService;
import com.timetracker.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService       projectService;
    private final ProjectExportService projectExportService;

    public ProjectController(ProjectService projectService,
                             ProjectExportService projectExportService) {
        this.projectService       = projectService;
        this.projectExportService = projectExportService;
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse createProject(@AuthenticationPrincipal UserDetails principal,
                                         @Valid @RequestBody CreateProjectRequest request) {
        return projectService.createProject(principal.getUsername(), request);
    }

    /** Returns all root-level projects where the user is either OWNER or MEMBER. */
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

    /**
     * Returns project summary with per-user contributions (US-023).
     * Optional ?userId={id} filters tasks and totalSeconds to a single member.
     * Returns 403 if userId belongs to someone who is not a project member.
     */
    @GetMapping("/{id}/summary")
    public ProjectSummaryResponse getProjectSummary(@AuthenticationPrincipal UserDetails principal,
                                                    @PathVariable Long id,
                                                    @RequestParam(required = false) String from,
                                                    @RequestParam(required = false) String to,
                                                    @RequestParam(required = false) Long userId) {
        Instant fromInstant = from != null ? Instant.parse(from) : null;
        Instant toInstant   = to   != null ? Instant.parse(to)   : null;
        return projectService.getProjectSummary(principal.getUsername(), id, fromInstant, toInstant, userId);
    }

    // ── Member management (US-022) ────────────────────────────────────────────

    /**
     * Invite a registered user to the project by email.
     * Only the project OWNER may call this endpoint.
     * Returns 404 if the email is unknown, 409 if already a member.
     */
    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public MemberResponse inviteMember(@AuthenticationPrincipal UserDetails principal,
                                       @PathVariable Long id,
                                       @Valid @RequestBody InviteMemberRequest request) {
        return projectService.inviteMember(principal.getUsername(), id, request);
    }

    /**
     * Remove a member from the project.
     * Only the project OWNER may call this endpoint.
     * Returns 400 if the owner tries to remove themselves.
     */
    @DeleteMapping("/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal UserDetails principal,
                             @PathVariable Long id,
                             @PathVariable Long userId) {
        projectService.removeMember(principal.getUsername(), id, userId);
    }

    /**
     * List all members of a project (name, email, role, joinedAt).
     * Accessible to any member (OWNER or MEMBER).
     */
    @GetMapping("/{id}/members")
    public List<MemberResponse> listMembers(@AuthenticationPrincipal UserDetails principal,
                                             @PathVariable Long id) {
        return projectService.listMembers(principal.getUsername(), id);
    }

    // ── Export (US-024) ───────────────────────────────────────────────────────

    /**
     * Download all tasks in the project subtree as CSV (default) or JSON.
     *
     * Params:
     *   format  — "csv" (default) or "json"
     *   from/to — ISO-8601 instant strings for an explicit date range
     *   year + month — convenience params for a calendar-month export (1-indexed month)
     *
     * Responds with Content-Disposition: attachment so the browser triggers a download.
     * Non-members receive 404 so project existence is not leaked.
     */
    @GetMapping("/{id}/export")
    public ResponseEntity<String> exportProject(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable Long id,
            @RequestParam(defaultValue = "csv") String format,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        Instant fromInstant = resolveFrom(from, year, month);
        Instant toInstant   = resolveTo(to, year, month);
        return projectExportService.export(principal.getUsername(), id, format, fromInstant, toInstant);
    }

    /** Resolve the start of the export window from an ISO string or a year+month pair. */
    private Instant resolveFrom(String from, Integer year, Integer month) {
        if (from != null) return Instant.parse(from);
        if (year != null && month != null) {
            return LocalDate.of(year, month, 1).atStartOfDay(ZoneOffset.UTC).toInstant();
        }
        return null;
    }

    /** Resolve the end of the export window from an ISO string or a year+month pair. */
    private Instant resolveTo(String to, Integer year, Integer month) {
        if (to != null) return Instant.parse(to);
        if (year != null && month != null) {
            return LocalDate.of(year, month, 1).plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        }
        return null;
    }
}
