package com.timetracker.service;

import com.timetracker.dto.user.UpdateProfileRequest;
import com.timetracker.dto.user.UserProfileResponse;
import com.timetracker.entity.User;
import com.timetracker.exception.InvalidTimezoneException;
import com.timetracker.repository.UserRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;

/**
 * US-025 — User profile management: get and update timezone (and optionally displayName).
 *
 * All timestamps remain stored as UTC — timezone affects only how the frontend
 * displays them, never what is persisted.
 */
@Service
public class UserProfileService {

    private final UserRepository userRepository;

    public UserProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /** Return the current profile for the authenticated user. */
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String email) {
        return UserProfileResponse.from(loadUser(email));
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    /**
     * Update the user's profile.
     *
     * Only non-null fields in the request are applied:
     *   - displayName: trimmed; ignored if blank
     *   - timezone: must be a recognised IANA identifier; validated with ZoneId.of()
     *
     * Throws InvalidTimezoneException (→ 400) if the timezone string is not a valid IANA ID.
     */
    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = loadUser(email);

        if (request.displayName() != null && !request.displayName().isBlank()) {
            user.setDisplayName(request.displayName().trim());
        }

        if (request.timezone() != null) {
            // Validate that the supplied string is a recognised IANA timezone identifier
            try {
                ZoneId.of(request.timezone());
            } catch (DateTimeException e) {
                throw new InvalidTimezoneException(request.timezone());
            }
            user.setTimezone(request.timezone());
        }

        return UserProfileResponse.from(userRepository.save(user));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
