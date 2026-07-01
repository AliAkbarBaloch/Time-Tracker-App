package com.timetracker.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.exception.ProjectNotFoundException;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * US-024 — Handles exporting a project's task history as CSV or JSON.
 *
 * Tasks are collected recursively from the entire project subtree so that
 * sub-project activity is always included in the download.
 */
@Service
public class ProjectExportService {

    private final ProjectRepository projectRepository;
    private final UserRepository    userRepository;
    private final ObjectMapper      objectMapper;

    public ProjectExportService(ProjectRepository projectRepository,
                                UserRepository userRepository,
                                ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.userRepository    = userRepository;
        this.objectMapper      = objectMapper;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Export all tasks in the project subtree.
     *
     * Non-members receive 404 (via findByIdAndMember) so that project existence
     * is not leaked.  Supports ?format=csv (default) or ?format=json, and an
     * optional date range via from/to Instants (already resolved from ISO strings
     * or year+month convenience params by the controller).
     */
    @Transactional(readOnly = true)
    public ResponseEntity<String> export(String userEmail, Long projectId,
                                          String format, Instant from, Instant to) {
        User user = loadUser(userEmail);

        // Any member (OWNER or MEMBER) may export; non-members receive 404
        Project project = projectRepository.findByIdAndMember(projectId, user)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));

        // Build a path map: projectId → "Root > Sub > ..." hierarchy string
        Map<Long, String> pathMap = new LinkedHashMap<>();
        buildPathMap(project, project.getName(), pathMap);

        // Collect unique tasks across the whole subtree, filtered by date range
        Set<Long>  seen  = new HashSet<>();
        List<Task> tasks = new ArrayList<>();
        collectTasks(project, from, to, seen, tasks);

        // Sort chronologically for a deterministic, readable export
        tasks.sort(Comparator.comparing(Task::getStartTime));

        // Sanitise the project name for use as a filename (replace special chars)
        String safeFilename = project.getName().replaceAll("[^a-zA-Z0-9-_]", "_");

        if ("json".equalsIgnoreCase(format)) {
            return buildJsonResponse(project.getName(), tasks, pathMap, safeFilename);
        }
        return buildCsvResponse(tasks, pathMap, safeFilename);
    }

    // ── CSV response builder ──────────────────────────────────────────────────

    /**
     * Build a CSV response with one header row and one row per task.
     * Columns: task_id, description, start_time, end_time, duration_seconds, projects, user.
     */
    private ResponseEntity<String> buildCsvResponse(List<Task> tasks,
                                                      Map<Long, String> pathMap,
                                                      String filenameBase) {
        StringBuilder sb = new StringBuilder();
        sb.append("task_id,description,start_time,end_time,duration_seconds,projects,user\n");

        for (Task t : tasks) {
            long duration = t.getEndTime() != null
                    ? t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond() : 0;

            sb.append(t.getId()).append(',')
              .append(csvEscape(t.getDescription())).append(',')
              .append(t.getStartTime()).append(',')
              .append(t.getEndTime() != null ? t.getEndTime() : "").append(',')
              .append(duration).append(',')
              .append(csvEscape(buildProjectPaths(t, pathMap))).append(',')
              .append(csvEscape(t.getUser().getDisplayName())).append('\n');
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filenameBase + "-export.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .body(sb.toString());
    }

    // ── JSON response builder ─────────────────────────────────────────────────

    /**
     * Build a JSON response with project name, exportedAt timestamp, and tasks array.
     * Each task entry mirrors the CSV columns but uses camelCase keys and an array
     * for the "projects" field instead of a pipe-separated string.
     */
    private ResponseEntity<String> buildJsonResponse(String projectName, List<Task> tasks,
                                                       Map<Long, String> pathMap,
                                                       String filenameBase) {
        List<Map<String, Object>> taskList = tasks.stream()
                .map(t -> {
                    long duration = t.getEndTime() != null
                            ? t.getEndTime().getEpochSecond() - t.getStartTime().getEpochSecond() : 0;

                    // LinkedHashMap preserves field order in the JSON output
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("id",              t.getId());
                    entry.put("description",     t.getDescription());
                    entry.put("startTime",       t.getStartTime().toString());
                    entry.put("endTime",         t.getEndTime() != null ? t.getEndTime().toString() : null);
                    entry.put("durationSeconds", duration);
                    entry.put("projects",        buildProjectPathList(t, pathMap));
                    entry.put("user",            t.getUser().getDisplayName());
                    return entry;
                })
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("project",    projectName);
        result.put("exportedAt", Instant.now().toString());
        result.put("tasks",      taskList);

        try {
            String json = objectMapper.writeValueAsString(result);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + filenameBase + "-export.json\"")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize project export to JSON", e);
        }
    }

    // ── Recursive collection helpers ──────────────────────────────────────────

    /**
     * Recursively collect unique tasks across the project subtree.
     * The seen set prevents double-counting tasks shared across multiple sub-projects.
     */
    private void collectTasks(Project project, Instant from, Instant to,
                               Set<Long> seen, List<Task> result) {
        for (Task task : project.getTasks()) {
            if (isInRange(task, from, to) && seen.add(task.getId())) {
                result.add(task);
            }
        }
        for (Project sub : project.getSubprojects()) {
            collectTasks(sub, from, to, seen, result);
        }
    }

    private boolean isInRange(Task task, Instant from, Instant to) {
        if (from != null && task.getStartTime().isBefore(from)) return false;
        if (to   != null && !task.getStartTime().isBefore(to))  return false;
        return true;
    }

    // ── Path map helpers ──────────────────────────────────────────────────────

    /**
     * Recursively populate pathMap with an entry for every project in the subtree.
     * Paths use " > " as the hierarchy separator
     * (e.g. "Thesis", "Thesis > Literature Review").
     */
    private void buildPathMap(Project project, String currentPath, Map<Long, String> pathMap) {
        pathMap.put(project.getId(), currentPath);
        for (Project sub : project.getSubprojects()) {
            buildPathMap(sub, currentPath + " > " + sub.getName(), pathMap);
        }
    }

    /**
     * Returns the project path(s) for a task as a pipe-separated string for CSV.
     * Only paths within the export subtree are included.
     */
    private String buildProjectPaths(Task task, Map<Long, String> pathMap) {
        return task.getProjects().stream()
                .filter(p -> pathMap.containsKey(p.getId()))
                .map(p -> pathMap.get(p.getId()))
                .sorted()
                .collect(Collectors.joining(" | "));
    }

    /** Same as buildProjectPaths but returns a List<String> for JSON serialization. */
    private List<String> buildProjectPathList(Task task, Map<Long, String> pathMap) {
        return task.getProjects().stream()
                .filter(p -> pathMap.containsKey(p.getId()))
                .map(p -> pathMap.get(p.getId()))
                .sorted()
                .collect(Collectors.toList());
    }

    // ── CSV escaping ──────────────────────────────────────────────────────────

    /**
     * RFC 4180 CSV field escaping.
     * Fields containing a comma, double-quote, or newline are wrapped in double-quotes;
     * any internal double-quotes are escaped by doubling them.
     */
    private String csvEscape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
