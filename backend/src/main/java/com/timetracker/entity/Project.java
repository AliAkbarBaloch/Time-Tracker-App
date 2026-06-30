package com.timetracker.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_project_id")
    private Project parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private List<Project> subprojects = new ArrayList<>();

    @ManyToMany(mappedBy = "projects")
    private Set<Task> tasks = new HashSet<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Project() {}

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public User getUser() { return user; }
    public Project getParent() { return parent; }
    public List<Project> getSubprojects() { return subprojects; }
    public Set<Task> getTasks() { return tasks; }
    public Instant getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setDescription(String description) { this.description = description; }
    public void setUser(User user) { this.user = user; }
    public void setParent(Project parent) { this.parent = parent; }
    public void setSubprojects(List<Project> subprojects) { this.subprojects = subprojects; }
    public void setTasks(Set<Task> tasks) { this.tasks = tasks; }
}
