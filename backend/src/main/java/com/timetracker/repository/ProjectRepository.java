package com.timetracker.repository;

import com.timetracker.entity.Project;
import com.timetracker.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByUserAndParentIsNull(User user);
    List<Project> findByUser(User user);
    Optional<Project> findByIdAndUser(Long id, User user);
}
