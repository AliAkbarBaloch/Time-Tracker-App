package com.timetracker.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class RateLimitServiceTest {

    @InjectMocks
    private RateLimitService rateLimitService;

    private static final long NOW = 1_700_000_000_000L;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(rateLimitService, "loginLimitPerMinute", 3);
    }

    @Test
    void firstRequest_isAllowed() {
        assertThat(rateLimitService.isLoginAllowed("1.2.3.4", NOW)).isTrue();
    }

    @Test
    void requestsUpToLimit_areAllowed() {
        assertThat(rateLimitService.isLoginAllowed("10.0.0.1", NOW)).isTrue();
        assertThat(rateLimitService.isLoginAllowed("10.0.0.1", NOW)).isTrue();
        assertThat(rateLimitService.isLoginAllowed("10.0.0.1", NOW)).isTrue();
    }

    @Test
    void requestOverLimit_isDenied() {
        rateLimitService.isLoginAllowed("10.0.0.2", NOW);
        rateLimitService.isLoginAllowed("10.0.0.2", NOW);
        rateLimitService.isLoginAllowed("10.0.0.2", NOW);
        assertThat(rateLimitService.isLoginAllowed("10.0.0.2", NOW)).isFalse();
    }

    @Test
    void newWindowAfterExpiry_allowsRequests() {
        rateLimitService.isLoginAllowed("10.0.0.3", NOW);
        rateLimitService.isLoginAllowed("10.0.0.3", NOW);
        rateLimitService.isLoginAllowed("10.0.0.3", NOW);
        assertThat(rateLimitService.isLoginAllowed("10.0.0.3", NOW)).isFalse();

        long afterWindow = NOW + 60_001L;
        assertThat(rateLimitService.isLoginAllowed("10.0.0.3", afterWindow)).isTrue();
    }

    @Test
    void differentIps_haveIndependentBuckets() {
        rateLimitService.isLoginAllowed("A.A.A.A", NOW);
        rateLimitService.isLoginAllowed("A.A.A.A", NOW);
        rateLimitService.isLoginAllowed("A.A.A.A", NOW);
        assertThat(rateLimitService.isLoginAllowed("A.A.A.A", NOW)).isFalse();

        assertThat(rateLimitService.isLoginAllowed("B.B.B.B", NOW)).isTrue();
    }

    @Test
    void requestAtExactWindowBoundary_startsNewWindow() {
        rateLimitService.isLoginAllowed("5.5.5.5", NOW);
        rateLimitService.isLoginAllowed("5.5.5.5", NOW);
        rateLimitService.isLoginAllowed("5.5.5.5", NOW);

        // At exactly windowEnd, a new window starts
        long exactBoundary = NOW + 60_000L;
        assertThat(rateLimitService.isLoginAllowed("5.5.5.5", exactBoundary)).isTrue();
    }

    @Test
    void publicMethod_delegatesToInternalMethod_allowsFirstRequest() {
        // Tests the public isLoginAllowed(String) that uses System.currentTimeMillis()
        assertThat(rateLimitService.isLoginAllowed("192.168.100.1")).isTrue();
    }
}
