package com.timetracker.service;

import com.timetracker.dto.task.TaskResponse;

public record TimerStartedEvent(String userEmail, TaskResponse task) {}
