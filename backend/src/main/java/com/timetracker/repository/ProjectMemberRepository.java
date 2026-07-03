package com.timetracker.repository;

import com.timetracker.entity.Project;
import com.timetracker.entity.ProjectMember;
import com.timetracker.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for managing project membership records.
 * Supports invite, remove, and membership checks needed by ProjectService.
 */
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    /** Find the specific membership row for a (project, user) pair. */
    Optional<ProjectMember> findByProjectAndUser(Project project, User user);

    /** List all memberships for a given project (used to build the members list response). */
    List<ProjectMember> findByProject(Project project);

    /** Quick existence check used to detect duplicate invites (returns 409). */
    boolean existsByProjectAndUser(Project project, User user);

    /** All memberships for a given user (used by analytics shared-breakdown). */
    List<ProjectMember> findByUser(User user);
}
