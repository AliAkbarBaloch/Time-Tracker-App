package com.timetracker.service;

import com.timetracker.dto.auth.AuthResponse;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.entity.User;
import com.timetracker.exception.EmailAlreadyExistsException;
import com.timetracker.repository.UserRepository;
import com.timetracker.security.JwtTokenProvider;
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

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtTokenProvider jwtTokenProvider;
    @Mock AuthenticationManager authenticationManager;

    @InjectMocks AuthService authService;

    @Test
    void register_validRequest_returnsAuthResponse() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");
        when(jwtTokenProvider.generateTokenFromEmail("alice@example.com")).thenReturn("jwt-token");

        RegisterRequest req = new RegisterRequest("alice@example.com", "password123", "Alice");
        AuthResponse resp = authService.register(req);

        assertThat(resp.token()).isEqualTo("jwt-token");
        assertThat(resp.email()).isEqualTo("alice@example.com");
        assertThat(resp.displayName()).isEqualTo("Alice");
        verify(userRepository).save(any(User.class));
        verify(passwordEncoder).encode("password123");
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
        assertThat(resp.email()).isEqualTo("alice@example.com");
        assertThat(resp.displayName()).isEqualTo("Alice");
    }

    @Test
    void login_badCredentials_propagatesException() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> authService.login(new LoginRequest("alice@example.com", "wrong")))
                .isInstanceOf(BadCredentialsException.class);
    }
}
