package com.timetracker.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tasks", indexes = {
    @Index(name = "idx_tasks_user_start", columnList = "user_id, start_time"),
    @Index(name = "idx_tasks_user_endtime", columnList = "user_id, end_time")
})
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private String description;

    @Column(nullable = false)
    private Instant startTime;

    @Column
    private Instant endTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToMany
    @JoinTable(
        name = "task_projects",
        joinColumns = @JoinColumn(name = "task_id"),
        inverseJoinColumns = @JoinColumn(name = "project_id")
    )
    @BatchSize(size = 30)
    private Set<Project> projects = new HashSet<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private long totalPreviousSeconds = 0L;

    public Task() {}

    public Long getId() { return id; }
    public String getDescription() { return description; }
    public Instant getStartTime() { return startTime; }
    public Instant getEndTime() { return endTime; }
    public User getUser() { return user; }
    public Set<Project> getProjects() { return projects; }
    public Instant getCreatedAt() { return createdAt; }
    public long getTotalPreviousSeconds() { return totalPreviousSeconds; }

    public void setDescription(String description) { this.description = description; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public void setUser(User user) { this.user = user; }
    public void setProjects(Set<Project> projects) { this.projects = projects; }
    public void setTotalPreviousSeconds(long totalPreviousSeconds) { this.totalPreviousSeconds = totalPreviousSeconds; }

    public boolean isRunning() { return endTime == null; }
}
