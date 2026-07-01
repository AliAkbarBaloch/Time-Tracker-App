package com.timetracker.repository;

import com.timetracker.entity.TaskTemplate;
import com.timetracker.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskTemplateRepository extends JpaRepository<TaskTemplate, Long> {

    List<TaskTemplate> findByUserOrderByCreatedAtDesc(User user);

    Optional<TaskTemplate> findByIdAndUser(Long id, User user);
}
