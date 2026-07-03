package com.timetracker.controller;

import com.timetracker.service.TimerEventService;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/timer")
public class TimerController {

    private final TimerEventService timerEventService;

    public TimerController(TimerEventService timerEventService) {
        this.timerEventService = timerEventService;
    }

    /**
     * SSE stream for the authenticated user's timer events.
     * EventSource cannot set Authorization headers, so JwtAuthFilter
     * also accepts a {@code ?token=} query parameter for this endpoint.
     */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeToTimerEvents(@AuthenticationPrincipal UserDetails principal) {
        return timerEventService.subscribe(principal.getUsername());
    }
}
