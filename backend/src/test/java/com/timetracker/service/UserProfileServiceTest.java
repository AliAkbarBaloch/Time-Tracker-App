package com.timetracker.service;

import com.timetracker.dto.user.UpdateProfileRequest;
import com.timetracker.dto.user.UserProfileResponse;
import com.timetracker.entity.User;
import com.timetracker.exception.InvalidTimezoneException;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock UserRepository userRepository;
    @InjectMocks UserProfileService userProfileService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setPasswordHash("hash");
        // default timezone is "UTC"
    }

    // ── getProfile ─────────────────────────────────────────────────────────────

    @Test
    void getProfile_returnsCorrectFields() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        UserProfileResponse profile = userProfileService.getProfile("alice@example.com");

        assertThat(profile.email()).isEqualTo("alice@example.com");
        assertThat(profile.displayName()).isEqualTo("Alice");
        assertThat(profile.timezone()).isEqualTo("UTC");
    }

    @Test
    void getProfile_userNotFound_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userProfileService.getProfile("ghost@example.com"))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }

    // ── updateProfile — displayName ────────────────────────────────────────────

    @Test
    void updateProfile_updatesDisplayName() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest("New Name", null);
        UserProfileResponse result = userProfileService.updateProfile("alice@example.com", req);

        assertThat(result.displayName()).isEqualTo("New Name");
        verify(userRepository).save(user);
    }

    @Test
    void updateProfile_trimmsDisplayName() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest("  Trimmed  ", null);
        userProfileService.updateProfile("alice@example.com", req);

        assertThat(user.getDisplayName()).isEqualTo("Trimmed");
    }

    @Test
    void updateProfile_blankDisplayName_isIgnored() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest("   ", null);
        userProfileService.updateProfile("alice@example.com", req);

        assertThat(user.getDisplayName()).isEqualTo("Alice"); // unchanged
    }

    @Test
    void updateProfile_nullDisplayName_isIgnored() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest(null, null);
        userProfileService.updateProfile("alice@example.com", req);

        assertThat(user.getDisplayName()).isEqualTo("Alice"); // unchanged
    }

    // ── updateProfile — timezone ───────────────────────────────────────────────

    @Test
    void updateProfile_updatesValidTimezone() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest(null, "Europe/Berlin");
        userProfileService.updateProfile("alice@example.com", req);

        assertThat(user.getTimezone()).isEqualTo("Europe/Berlin");
    }

    @Test
    void updateProfile_invalidTimezone_throwsInvalidTimezoneException() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        UpdateProfileRequest req = new UpdateProfileRequest(null, "Not/AZone");
        assertThatThrownBy(() -> userProfileService.updateProfile("alice@example.com", req))
                .isInstanceOf(InvalidTimezoneException.class);
    }

    @Test
    void updateProfile_bogusTimezoneString_throws() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        UpdateProfileRequest req = new UpdateProfileRequest(null, "completely_bogus");
        assertThatThrownBy(() -> userProfileService.updateProfile("alice@example.com", req))
                .isInstanceOf(InvalidTimezoneException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    void updateProfile_nullTimezone_isIgnored() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest(null, null);
        userProfileService.updateProfile("alice@example.com", req);

        assertThat(user.getTimezone()).isEqualTo("UTC"); // unchanged
    }

    @Test
    void updateProfile_bothFieldsUpdatedTogether() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        UpdateProfileRequest req = new UpdateProfileRequest("Bob", "Asia/Kolkata");
        userProfileService.updateProfile("alice@example.com", req);

        assertThat(user.getDisplayName()).isEqualTo("Bob");
        assertThat(user.getTimezone()).isEqualTo("Asia/Kolkata");
    }

    @Test
    void updateProfile_userNotFound_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userProfileService.updateProfile("ghost@example.com",
                new UpdateProfileRequest("X", null)))
                .isInstanceOf(org.springframework.security.core.userdetails.UsernameNotFoundException.class);
    }
}
