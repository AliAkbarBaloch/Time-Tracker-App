package com.timetracker.service;

import com.timetracker.entity.RefreshToken;
import com.timetracker.entity.User;
import com.timetracker.exception.InvalidRefreshTokenException;
import com.timetracker.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock RefreshTokenRepository refreshTokenRepository;

    @InjectMocks RefreshTokenService refreshTokenService;

    private User makeUser() {
        User user = new User();
        user.setEmail("alice@example.com");
        return user;
    }

    @Test
    void createRefreshToken_deletesExistingAndSavesNew() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshExpirationDays", 30);
        User user = makeUser();
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        RefreshToken result = refreshTokenService.createRefreshToken(user);

        verify(refreshTokenRepository).deleteByUser(user);
        verify(refreshTokenRepository).flush();
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        RefreshToken saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getToken()).isNotNull().hasSize(36); // UUID string
        assertThat(saved.getExpiresAt()).isAfter(Instant.now());
        assertThat(result).isSameAs(saved);
    }

    @Test
    void createRefreshToken_expiresAtIsApproximately30DaysFromNow() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshExpirationDays", 30);
        User user = makeUser();
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        RefreshToken result = refreshTokenService.createRefreshToken(user);

        Instant expectedExpiry = Instant.now().plusSeconds(30L * 24 * 3600);
        assertThat(result.getExpiresAt()).isBetween(
                expectedExpiry.minusSeconds(5), expectedExpiry.plusSeconds(5));
    }

    @Test
    void validateRefreshToken_validToken_returnsToken() {
        User user = makeUser();
        RefreshToken token = new RefreshToken();
        token.setToken("valid-uuid");
        token.setUser(user);
        token.setRevoked(false);
        token.setExpiresAt(Instant.now().plusSeconds(3600));

        when(refreshTokenRepository.findByToken("valid-uuid")).thenReturn(Optional.of(token));

        RefreshToken result = refreshTokenService.validateRefreshToken("valid-uuid");
        assertThat(result).isSameAs(token);
    }

    @Test
    void validateRefreshToken_notFound_throwsException() {
        when(refreshTokenRepository.findByToken("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> refreshTokenService.validateRefreshToken("missing"))
                .isInstanceOf(InvalidRefreshTokenException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void validateRefreshToken_revoked_throwsException() {
        RefreshToken token = new RefreshToken();
        token.setToken("revoked-uuid");
        token.setRevoked(true);
        token.setExpiresAt(Instant.now().plusSeconds(3600));

        when(refreshTokenRepository.findByToken("revoked-uuid")).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> refreshTokenService.validateRefreshToken("revoked-uuid"))
                .isInstanceOf(InvalidRefreshTokenException.class)
                .hasMessageContaining("revoked");
    }

    @Test
    void validateRefreshToken_expired_throwsException() {
        RefreshToken token = new RefreshToken();
        token.setToken("expired-uuid");
        token.setRevoked(false);
        token.setExpiresAt(Instant.now().minusSeconds(1)); // in the past

        when(refreshTokenRepository.findByToken("expired-uuid")).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> refreshTokenService.validateRefreshToken("expired-uuid"))
                .isInstanceOf(InvalidRefreshTokenException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void revokeToken_existingToken_setsRevokedTrue() {
        RefreshToken token = new RefreshToken();
        token.setToken("to-revoke");
        token.setRevoked(false);

        when(refreshTokenRepository.findByToken("to-revoke")).thenReturn(Optional.of(token));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        refreshTokenService.revokeToken("to-revoke");

        assertThat(token.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(token);
    }

    @Test
    void revokeToken_notFound_noExceptionThrown() {
        when(refreshTokenRepository.findByToken("ghost")).thenReturn(Optional.empty());

        refreshTokenService.revokeToken("ghost");
        // No exception: ifPresent → noop when absent
    }
}
