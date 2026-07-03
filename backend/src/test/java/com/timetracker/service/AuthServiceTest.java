package com.timetracker.service;

import com.timetracker.dto.auth.AuthResponse;
import com.timetracker.dto.auth.ChangePasswordRequest;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.entity.RefreshToken;
import com.timetracker.entity.User;
import com.timetracker.exception.EmailAlreadyExistsException;
import com.timetracker.exception.InvalidRefreshTokenException;
import com.timetracker.exception.WrongPasswordException;
import com.timetracker.repository.UserRepository;
import com.timetracker.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.argThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtTokenProvider jwtTokenProvider;
    @Mock AuthenticationManager authenticationManager;
    @Mock RefreshTokenService refreshTokenService;

    @InjectMocks AuthService authService;

    private RefreshToken mockRefreshToken;

    @BeforeEach
    void setUp() {
        mockRefreshToken = new RefreshToken();
        mockRefreshToken.setToken("refresh-uuid-token");
        mockRefreshToken.setExpiresAt(Instant.now().plusSeconds(86400));
        lenient().when(refreshTokenService.createRefreshToken(any(User.class))).thenReturn(mockRefreshToken);
    }

    @Test
    void register_validRequest_returnsAuthResponse() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");
        when(jwtTokenProvider.generateTokenFromEmail("alice@example.com")).thenReturn("jwt-token");

        RegisterRequest req = new RegisterRequest("alice@example.com", "password123", "Alice");
        AuthResponse resp = authService.register(req);

        assertThat(resp.token()).isEqualTo("jwt-token");
        assertThat(resp.refreshToken()).isEqualTo("refresh-uuid-token");
        assertThat(resp.email()).isEqualTo("alice@example.com");
        assertThat(resp.displayName()).isEqualTo("Alice");
        verify(userRepository).save(any(User.class));
        verify(passwordEncoder).encode("password123");
        verify(refreshTokenService).createRefreshToken(any(User.class));
    }

    @Test
    void register_duplicateEmail_throwsEmailAlreadyExistsException() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        RegisterRequest req = new RegisterRequest("alice@example.com", "password123", "Alice");
        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(EmailAlreadyExistsException.class)
                .hasMessageContaining("alice@example.com");

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_passwordIsHashed_neverStoredPlainText() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-password");
        when(jwtTokenProvider.generateTokenFromEmail(anyString())).thenReturn("jwt-token");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            assertThat(u.getPasswordHash()).isEqualTo("hashed-password");
            assertThat(u.getPasswordHash()).isNotEqualTo("password123");
            return u;
        });

        authService.register(new RegisterRequest("bob@example.com", "password123", "Bob"));
        verify(userRepository).save(any(User.class));
    }

    @Test
    void login_validCredentials_returnsAuthResponse() {
        Authentication auth = mock(Authentication.class);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(auth);
        when(jwtTokenProvider.generateToken(auth)).thenReturn("jwt-token");

        User user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setPasswordHash("hashed");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        AuthResponse resp = authService.login(new LoginRequest("alice@example.com", "password123"));

        assertThat(resp.token()).isEqualTo("jwt-token");
        assertThat(resp.refreshToken()).isEqualTo("refresh-uuid-token");
        assertThat(resp.email()).isEqualTo("alice@example.com");
        assertThat(resp.displayName()).isEqualTo("Alice");
        verify(refreshTokenService).createRefreshToken(user);
    }

    @Test
    void login_badCredentials_propagatesException() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> authService.login(new LoginRequest("alice@example.com", "wrong")))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void refreshAccessToken_validToken_rotatesToNewTokens() {
        User user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");

        RefreshToken oldToken = new RefreshToken();
        oldToken.setToken("old-refresh");
        oldToken.setUser(user);
        oldToken.setExpiresAt(Instant.now().plusSeconds(3600));

        RefreshToken newToken = new RefreshToken();
        newToken.setToken("new-refresh");
        newToken.setExpiresAt(Instant.now().plusSeconds(86400));

        when(refreshTokenService.validateRefreshToken("old-refresh")).thenReturn(oldToken);
        when(refreshTokenService.createRefreshToken(user)).thenReturn(newToken);
        when(jwtTokenProvider.generateTokenFromEmail("alice@example.com")).thenReturn("new-access-token");

        AuthResponse resp = authService.refreshAccessToken("old-refresh");

        assertThat(resp.token()).isEqualTo("new-access-token");
        assertThat(resp.refreshToken()).isEqualTo("new-refresh");
        assertThat(resp.email()).isEqualTo("alice@example.com");
        verify(refreshTokenService).revokeToken("old-refresh");
        verify(refreshTokenService).createRefreshToken(user);
    }

    @Test
    void refreshAccessToken_invalidToken_throwsInvalidRefreshTokenException() {
        when(refreshTokenService.validateRefreshToken("bad-token"))
                .thenThrow(new InvalidRefreshTokenException("Refresh token not found"));

        assertThatThrownBy(() -> authService.refreshAccessToken("bad-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void revokeRefreshToken_delegatesToRefreshTokenService() {
        authService.revokeRefreshToken("some-token");
        verify(refreshTokenService).revokeToken("some-token");
    }

    @Test
    void changePassword_correctCurrentPassword_updatesHash() {
        User user = new User();
        user.setEmail("alice@example.com");
        user.setPasswordHash("old-hash");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-pass", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("new-pass-123")).thenReturn("new-hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.changePassword("alice@example.com", new ChangePasswordRequest("old-pass", "new-pass-123"));

        verify(userRepository).save(argThat(u -> u.getPasswordHash().equals("new-hash")));
    }

    @Test
    void changePassword_wrongCurrentPassword_throwsWrongPasswordException() {
        User user = new User();
        user.setEmail("alice@example.com");
        user.setPasswordHash("old-hash");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "old-hash")).thenReturn(false);

        assertThatThrownBy(() ->
                authService.changePassword("alice@example.com", new ChangePasswordRequest("wrong", "new-pass-123")))
                .isInstanceOf(WrongPasswordException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void changePassword_newPasswordIsHashed_neverStoredPlainText() {
        User user = new User();
        user.setEmail("alice@example.com");
        user.setPasswordHash("old-hash");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-pass", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("brandNewPass1")).thenReturn("hashed-new");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.changePassword("alice@example.com", new ChangePasswordRequest("old-pass", "brandNewPass1"));

        verify(passwordEncoder).encode("brandNewPass1");
        verify(userRepository).save(argThat(u -> "hashed-new".equals(u.getPasswordHash())));
    }
}
