package com.timetracker.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "projects")
@Getter @Setter @NoArgsConstructor
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

    // Self-referencing for hierarchy: null = top-level project
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_project_id")
    private Project parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private List<Project> subprojects = new ArrayList<>();

    @ManyToMany(mappedBy = "projects")
    private Set<Task> tasks = new HashSet<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
