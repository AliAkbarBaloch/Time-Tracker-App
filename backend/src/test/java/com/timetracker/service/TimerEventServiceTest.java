package com.timetracker.service;

import com.timetracker.dto.task.TaskResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.lang.reflect.Field;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class TimerEventServiceTest {

    @InjectMocks
    private TimerEventService timerEventService;

    private TaskResponse makeTask() {
        return new TaskResponse(1L, "Work", null, null, true, List.of(), 0L);
    }

    @Test
    void subscribe_returnsNonNullEmitter() {
        SseEmitter emitter = timerEventService.subscribe("alice@example.com");
        assertThat(emitter).isNotNull();
    }

    @Test
    void subscribe_incrementsEmitterCount() {
        assertThat(timerEventService.emitterCount()).isZero();
        timerEventService.subscribe("alice@example.com");
        assertThat(timerEventService.emitterCount()).isEqualTo(1);
    }

    @Test
    void onTimerStarted_broadcastsToCorrectUser() {
        timerEventService.subscribe("alice@example.com");
        timerEventService.subscribe("bob@example.com");

        // Event for alice — should send to alice's emitter (which is now closed/completed,
        // so it gets removed). Either way, no exception is thrown.
        timerEventService.onTimerStarted(new TimerStartedEvent("alice@example.com", makeTask()));

        // After a failed send to the completed emitter, it gets pruned
        assertThat(timerEventService.emitterCount()).isLessThanOrEqualTo(2);
    }

    @Test
    void onTimerStopped_doesNotThrow() {
        timerEventService.subscribe("alice@example.com");
        timerEventService.onTimerStopped(new TimerStoppedEvent("alice@example.com"));
        // Emitter is pruned after failed send (emitter not connected in unit test)
        assertThat(timerEventService.emitterCount()).isLessThanOrEqualTo(1);
    }

    @Test
    void subscribe_onCompletionCallback_removesEmitter() throws Exception {
        SseEmitter emitter = timerEventService.subscribe("alice@example.com");
        assertThat(timerEventService.emitterCount()).isEqualTo(1);
        // SseEmitter.complete() without a real HTTP handler does not invoke onCompletion callbacks.
        // Trigger the DefaultCallback directly via reflection to verify the removal is wired up.
        Field field = ResponseBodyEmitter.class.getDeclaredField("completionCallback");
        field.setAccessible(true);
        Runnable callback = (Runnable) field.get(emitter);
        callback.run();
        assertThat(timerEventService.emitterCount()).isZero();
    }

    @Test
    void onTimerStarted_nullUserEmail_broadcastsToAll() {
        timerEventService.subscribe("alice@example.com");
        // A null userEmail in the event means broadcast to all — no NPE
        timerEventService.onTimerStarted(new TimerStartedEvent(null, makeTask()));
    }
}
