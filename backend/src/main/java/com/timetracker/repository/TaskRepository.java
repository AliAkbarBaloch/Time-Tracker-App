package com.timetracker.repository;

import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.projects WHERE t.user = :user ORDER BY t.startTime DESC")
    List<Task> findByUserOrderByStartTimeDesc(@Param("user") User user);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.projects WHERE t.user = :user AND t.startTime >= :from AND t.startTime <= :to ORDER BY t.startTime ASC")
    List<Task> findByUserAndStartTimeBetweenOrderByStartTimeAsc(@Param("user") User user, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.projects WHERE t.user = :user AND t.startTime >= :from ORDER BY t.startTime ASC")
    List<Task> findByUserAndStartTimeGreaterThanEqualOrderByStartTimeAsc(@Param("user") User user, @Param("from") Instant from);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.projects WHERE t.user = :user AND t.startTime <= :to ORDER BY t.startTime ASC")
    List<Task> findByUserAndStartTimeLessThanEqualOrderByStartTimeAsc(@Param("user") User user, @Param("to") Instant to);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.projects WHERE t.user = :user AND t.endTime IS NULL")
    Optional<Task> findByUserAndEndTimeIsNull(@Param("user") User user);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.projects WHERE t.id = :id AND t.user = :user")
    Optional<Task> findByIdAndUser(@Param("id") Long id, @Param("user") User user);
}
