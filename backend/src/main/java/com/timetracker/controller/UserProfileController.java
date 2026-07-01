package com.timetracker.controller;

import com.timetracker.dto.user.UpdateProfileRequest;
import com.timetracker.dto.user.UserProfileResponse;
import com.timetracker.service.UserProfileService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * US-025 — User profile endpoints.
 *
 * GET  /api/users/profile  — returns current profile including timezone
 * PUT  /api/users/profile  — updates timezone (and optionally displayName)
 *
 * Changing timezone never alters stored UTC timestamps; it only affects
 * how the frontend renders dates for this user.
 */
@RestController
@RequestMapping("/api/users")
public class UserProfileController {

    private final UserProfileService profileService;

    public UserProfileController(UserProfileService profileService) {
        this.profileService = profileService;
    }

    /** Returns id, email, displayName, timezone, createdAt for the authenticated user. */
    @GetMapping("/profile")
    public UserProfileResponse getProfile(@AuthenticationPrincipal UserDetails principal) {
        return profileService.getProfile(principal.getUsername());
    }

    /**
     * Update the authenticated user's profile.
     * Only non-null fields are changed.  Returns the updated profile on success.
     * Returns 400 if the timezone string is not a valid IANA identifier.
     */
    @PutMapping("/profile")
    public UserProfileResponse updateProfile(@AuthenticationPrincipal UserDetails principal,
                                              @RequestBody UpdateProfileRequest request) {
        return profileService.updateProfile(principal.getUsername(), request);
    }
}
