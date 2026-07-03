package com.timetracker.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory, per-IP sliding-window rate limiter for the login endpoint.
 *
 * Each IP gets a fixed-size counter that resets after 60 seconds.
 * The package-private {@code isLoginAllowed(ip, nowMs)} overload accepts an
 * explicit clock value so unit tests can control time without sleeping.
 */
@Service
public class RateLimitService {

    @Value("${app.rate-limit.login-per-minute:10}")
    private int loginLimitPerMinute;

    private final ConcurrentHashMap<String, long[]> buckets = new ConcurrentHashMap<>();

    public boolean isLoginAllowed(String ip) {
        return isLoginAllowed(ip, System.currentTimeMillis());
    }

    boolean isLoginAllowed(String ip, long nowMs) {
        long[] bucket = buckets.compute(ip, (k, v) -> {
            if (v == null || nowMs >= v[1]) {
                return new long[]{1L, nowMs + 60_000L};
            }
            v[0]++;
            return v;
        });
        return bucket[0] <= loginLimitPerMinute;
    }
}
