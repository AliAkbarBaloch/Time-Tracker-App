package com.timetracker.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Represents the membership of a User in a Project.
 * A unique row per (project, user) pair is enforced by the uk_project_member constraint.
 * On first boot a MembershipSeeder creates OWNER rows for all pre-existing projects.
 */
@Entity
@Table(
    name = "project_members",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_project_member",
        columnNames = {"project_id", "user_id"}
    )
)
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The project this membership belongs to. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** The user who is a member of the project. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** OWNER: can manage members / edit / delete.  MEMBER: can add tasks. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectMemberRole role;

    /** Timestamp when the membership was created (invite accepted or project created). */
    @Column(nullable = false, updatable = false)
    private Instant joinedAt = Instant.now();

    public ProjectMember() {}

    public Long getId() { return id; }
    public Project getProject() { return project; }
    public User getUser() { return user; }
    public ProjectMemberRole getRole() { return role; }
    public Instant getJoinedAt() { return joinedAt; }

    public void setProject(Project project) { this.project = project; }
    public void setUser(User user) { this.user = user; }
    public void setRole(ProjectMemberRole role) { this.role = role; }
}
