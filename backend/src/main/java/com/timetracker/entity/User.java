package com.timetracker.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Email
    @NotBlank
    @Column(unique = true, nullable = false)
    private String email;

    @NotBlank
    @Column(nullable = false)
    private String displayName;

    @NotBlank
    @Column(nullable = false)
    private String passwordHash;

    /** IANA timezone identifier (e.g. "Europe/Berlin"). Stored as UTC in DB; display-only (US-025). */
    @Column(nullable = false)
    private String timezone = "UTC";

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Project> projects = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Task> tasks = new ArrayList<>();

    public User() {}

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
    public String getPasswordHash() { return passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
    public List<Project> getProjects() { return projects; }
    public List<Task> getTasks() { return tasks; }

    public void setEmail(String email) { this.email = email; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public String getTimezone() { return timezone; }
    public void setProjects(List<Project> projects) { this.projects = projects; }
    public void setTasks(List<Task> tasks) { this.tasks = tasks; }
}
