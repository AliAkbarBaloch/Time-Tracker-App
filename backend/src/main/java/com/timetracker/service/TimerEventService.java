package com.timetracker.service;

import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Manages SSE connections per user and broadcasts timer events.
 * Each connected client receives a personal stream; events are
 * published via Spring's ApplicationEventPublisher from TaskService.
 */
@Service
public class TimerEventService {

    private final CopyOnWriteArrayList<UserEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe(String userEmail) {
        SseEmitter emitter = new SseEmitter(300_000L);
        UserEmitter ue = new UserEmitter(userEmail, emitter);
        emitters.add(ue);
        emitter.onCompletion(() -> emitters.remove(ue));
        emitter.onTimeout(() -> {
            emitter.complete();
            emitters.remove(ue);
        });
        emitter.onError(ex -> emitters.remove(ue));
        return emitter;
    }

    @EventListener
    public void onTimerStarted(TimerStartedEvent event) {
        broadcast(event.userEmail(), "timer-started", event.task());
    }

    @EventListener
    public void onTimerStopped(TimerStoppedEvent event) {
        broadcast(event.userEmail(), "timer-stopped", null);
    }

    private void broadcast(String userEmail, String eventName, Object data) {
        List<UserEmitter> dead = new ArrayList<>();
        for (UserEmitter ue : emitters) {
            if (userEmail != null && !userEmail.equals(ue.userEmail())) {
                continue;
            }
            try {
                SseEmitter.SseEventBuilder builder = SseEmitter.event().name(eventName);
                if (data != null) {
                    builder.data(data, MediaType.APPLICATION_JSON);
                } else {
                    builder.data("");
                }
                ue.emitter().send(builder);
            } catch (Exception ex) {
                dead.add(ue);
            }
        }
        emitters.removeAll(dead);
    }

    int emitterCount() {
        return emitters.size();
    }

    private record UserEmitter(String userEmail, SseEmitter emitter) {}
}
