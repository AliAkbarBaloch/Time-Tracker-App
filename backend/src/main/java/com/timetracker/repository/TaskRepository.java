package com.timetracker.repository;

import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserOrderByStartTimeDesc(User user);
    List<Task> findByUserAndStartTimeBetweenOrderByStartTimeAsc(User user, Instant from, Instant to);
    Optional<Task> findByUserAndEndTimeIsNull(User user);
    Optional<Task> findByIdAndUser(Long id, User user);
}
