package com.timetracker.service;

import com.timetracker.entity.RefreshToken;
import com.timetracker.entity.User;
import com.timetracker.exception.InvalidRefreshTokenException;
import com.timetracker.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class RefreshTokenService {

    @Value("${app.jwt.refresh-expiration-days:30}")
    private int refreshExpirationDays;

    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @Transactional
    public RefreshToken createRefreshToken(User user) {
        refreshTokenRepository.deleteByUser(user);
        refreshTokenRepository.flush();

        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setToken(UUID.randomUUID().toString());
        token.setExpiresAt(Instant.now().plus(refreshExpirationDays, ChronoUnit.DAYS));
        return refreshTokenRepository.save(token);
    }

    public RefreshToken validateRefreshToken(String tokenValue) {
        RefreshToken token = refreshTokenRepository.findByToken(tokenValue)
                .orElseThrow(() -> new InvalidRefreshTokenException("Refresh token not found"));
        if (token.isRevoked()) {
            throw new InvalidRefreshTokenException("Refresh token has been revoked");
        }
        if (Instant.now().isAfter(token.getExpiresAt())) {
            throw new InvalidRefreshTokenException("Refresh token has expired");
        }
        return token;
    }

    @Transactional
    public void revokeToken(String tokenValue) {
        refreshTokenRepository.findByToken(tokenValue).ifPresent(t -> {
            t.setRevoked(true);
            refreshTokenRepository.save(t);
        });
    }
}
