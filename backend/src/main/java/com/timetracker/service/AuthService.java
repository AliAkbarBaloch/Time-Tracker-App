package com.timetracker.service;

import com.timetracker.dto.auth.AuthResponse;
import com.timetracker.dto.auth.ChangePasswordRequest;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.entity.RefreshToken;
import com.timetracker.entity.User;
import com.timetracker.exception.EmailAlreadyExistsException;
import com.timetracker.exception.WrongPasswordException;
import com.timetracker.repository.UserRepository;
import com.timetracker.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       AuthenticationManager authenticationManager,
                       RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authenticationManager = authenticationManager;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException(request.email());
        }
        User user = new User();
        user.setEmail(request.email());
        user.setDisplayName(request.displayName());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);
        String token = jwtTokenProvider.generateTokenFromEmail(user.getEmail());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);
        return new AuthResponse(token, refreshToken.getToken(),
                user.getEmail(), user.getDisplayName(), user.getTimezone());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );
        String token = jwtTokenProvider.generateToken(authentication);
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found"));
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);
        return new AuthResponse(token, refreshToken.getToken(),
                user.getEmail(), user.getDisplayName(), user.getTimezone());
    }

    @Transactional
    public AuthResponse refreshAccessToken(String refreshTokenValue) {
        RefreshToken refreshToken = refreshTokenService.validateRefreshToken(refreshTokenValue);
        User user = refreshToken.getUser();
        refreshTokenService.revokeToken(refreshTokenValue);
        RefreshToken newRefreshToken = refreshTokenService.createRefreshToken(user);
        String newAccessToken = jwtTokenProvider.generateTokenFromEmail(user.getEmail());
        return new AuthResponse(newAccessToken, newRefreshToken.getToken(),
                user.getEmail(), user.getDisplayName(), user.getTimezone());
    }

    @Transactional
    public void revokeRefreshToken(String refreshTokenValue) {
        refreshTokenService.revokeToken(refreshTokenValue);
    }

    @Transactional
    public void changePassword(String userEmail, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new WrongPasswordException();
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }
}
