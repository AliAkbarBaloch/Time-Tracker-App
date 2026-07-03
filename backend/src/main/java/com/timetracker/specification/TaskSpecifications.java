package com.timetracker.specification;

import com.timetracker.entity.Project;
import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.Set;

/**
 * Composable JPA Specification predicates for Task queries.
 * Combine with Specification.where(...).and(...) to build dynamic filters
 * that are evaluated entirely in the database — no in-memory stream filtering.
 */
public final class TaskSpecifications {

    private TaskSpecifications() {}

    public static Specification<Task> ownedBy(User user) {
        return (root, query, cb) -> cb.equal(root.get("user"), user);
    }

    public static Specification<Task> startedAtOrAfter(Instant from) {
        return (root, query, cb) ->
            cb.greaterThanOrEqualTo(root.get("startTime"), from);
    }

    public static Specification<Task> startedBefore(Instant to) {
        return (root, query, cb) ->
            cb.lessThanOrEqualTo(root.get("startTime"), to);
    }

    /** Case-insensitive substring match on description. Null descriptions never match. */
    public static Specification<Task> descriptionContains(String search) {
        String pattern = "%" + search.toLowerCase() + "%";
        return (root, query, cb) ->
            cb.like(cb.lower(root.get("description")), pattern);
    }

    /**
     * Restricts results to tasks associated with any project in the given ID set.
     * Uses an INNER JOIN so tasks with no projects are automatically excluded.
     * Returns a never-matching predicate when the set is empty.
     */
    public static Specification<Task> inProjects(Set<Long> projectIds) {
        if (projectIds.isEmpty()) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            Join<Task, Project> join = root.join("projects", JoinType.INNER);
            query.distinct(true);
            return join.get("id").in(projectIds);
        };
    }
}
