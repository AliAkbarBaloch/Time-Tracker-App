package com.timetracker.repository;

import com.timetracker.entity.Project;
import com.timetracker.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    // ── Legacy owner-only queries (kept for backward compat in TaskService) ──

    /** All root projects strictly owned by a user (used for name-conflict check during create). */
    List<Project> findByUserAndParentIsNull(User user);

    /** All projects owned by a user (used for name-conflict validation). */
    List<Project> findByUser(User user);

    /** Find a project by id that is strictly owned by the user (OWNER-only operations: edit, delete). */
    Optional<Project> findByIdAndUser(Long id, User user);

    // ── Member-aware queries (US-022) ─────────────────────────────────────────

    /**
     * All root-level projects where the user holds any membership (OWNER or MEMBER).
     * Replaces findByUserAndParentIsNull for the list-projects use-case so that
     * shared projects are visible alongside owned ones.
     */
    @Query("SELECT DISTINCT p FROM Project p JOIN p.members m WHERE m.user = :user AND p.parent IS NULL")
    List<Project> findRootProjectsByMember(@Param("user") User user);

    /**
     * Find a project by id where the user has any membership.
     * Used for read operations (summary, member list) that are accessible to all members.
     */
    @Query("SELECT p FROM Project p JOIN p.members m WHERE p.id = :id AND m.user = :user")
    Optional<Project> findByIdAndMember(@Param("id") Long id, @Param("user") User user);
}
