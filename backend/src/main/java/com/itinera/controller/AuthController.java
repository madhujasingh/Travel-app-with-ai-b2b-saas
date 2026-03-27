package com.itinera.controller;

import com.itinera.config.JwtUtil;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.jackson2.JacksonFactory;
import com.itinera.model.User;
import com.itinera.repository.SupplierRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = {"http://localhost:19006", "http://localhost:8081", "exp://localhost:19000"})
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private SupplierRepository supplierRepository;

    @Value("${auth.max-admin-count:2}")
    private long maxAdminCount;

    @Value("${auth.authorized-admin-emails:admin@itinera.com}")
    private String authorizedAdminEmails;

    @Value("${google.web-client-id:}")
    private String googleWebClientId;
    @Value("${google.ios-client-id:}")
    private String googleIosClientId;
    @Value("${google.android-client-id:}")
    private String googleAndroidClientId;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request.getEmail() == null || request.getPassword() == null || request.getName() == null || request.getPhone() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name, email, phone and password are required"));
        }

        String email = request.getEmail().trim().toLowerCase();

        // Check if email already exists
        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
        }

        User.UserRole requestedRole = request.getRole() == null
                ? User.UserRole.CUSTOMER
                : User.UserRole.valueOf(request.getRole().toUpperCase());

        // Public users can always sign up as CUSTOMER
        if (requestedRole == User.UserRole.CUSTOMER) {
            // allowed
        } else if (requestedRole == User.UserRole.SUPPLIER) {
            // Supplier registration allowed only for pre-authorized suppliers
            boolean isAuthorizedSupplier = supplierRepository.existsByEmailAndIsVerifiedTrueAndIsActiveTrue(email);
            if (!isAuthorizedSupplier) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Supplier signup is restricted",
                        "message", "Your email is not an authorized verified supplier"
                ));
            }
        } else if (requestedRole == User.UserRole.ADMIN) {
            // Admin signup allowed only for explicitly authorized emails and limited count
            List<String> allowedAdminEmails = Arrays.stream(authorizedAdminEmails.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());

            if (!allowedAdminEmails.contains(email)) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Admin signup is restricted",
                        "message", "Your email is not authorized for admin access"
                ));
            }

            long existingAdmins = userRepository.countByRole(User.UserRole.ADMIN);
            if (existingAdmins >= maxAdminCount) {
                return ResponseEntity.status(403).body(Map.of(
                        "error", "Admin limit reached",
                        "message", "Maximum allowed admin accounts: " + maxAdminCount
                ));
            }
        } else {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Role not allowed for public signup",
                    "message", "Please sign up as CUSTOMER"
            ));
        }

        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setPhone(request.getPhone().trim());
        user.setRole(requestedRole);
        user.setPassword(request.getPassword());

        User savedUser = userRepository.save(user);

        // Generate JWT token
        String token = jwtUtil.generateToken(savedUser.getId(), savedUser.getEmail(), savedUser.getRole().name());

        return ResponseEntity.ok(buildAuthResponse(savedUser, token));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
        }

        Optional<User> userOpt = userRepository.findByEmail(email.trim().toLowerCase());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }

        User user = userOpt.get();
        if (!user.checkPassword(password)) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
        }

        // Generate JWT token
        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name());

        return ResponseEntity.ok(buildAuthResponse(user, token));
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleAuth(@RequestBody GoogleAuthRequest request) {
        try {
            if (request == null || request.getIdToken() == null || request.getIdToken().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "idToken is required"));
            }

            List<String> audiences = getGoogleAudiences();
            if (audiences.isEmpty()) {
                return ResponseEntity.status(500).body(Map.of(
                        "error", "Google auth not configured",
                        "message", "Set GOOGLE_WEB_CLIENT_ID (and optionally GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID) in backend/.env"
                ));
            }

            GoogleIdToken.Payload payload;
            try {
                payload = verifyGoogleIdToken(request.getIdToken(), audiences);
            } catch (GeneralSecurityException | IOException | IllegalArgumentException e) {
                return ResponseEntity.status(401).body(Map.of(
                        "error", "Invalid Google token",
                        "message", "Could not validate Google sign-in token"
                ));
            }

            if (payload == null || payload.getEmail() == null) {
                return ResponseEntity.status(401).body(Map.of(
                        "error", "Invalid Google token",
                        "message", "Google token verification failed"
                ));
            }

            boolean emailVerified = Boolean.TRUE.equals(payload.getEmailVerified());
            if (!emailVerified) {
                return ResponseEntity.status(401).body(Map.of(
                        "error", "Email not verified",
                        "message", "Google account email is not verified"
                ));
            }

            String email = payload.getEmail().trim().toLowerCase();
            String nameFromGoogle = payload.get("name") != null ? String.valueOf(payload.get("name")) : "Google User";

            User user = userRepository.findByEmail(email).orElseGet(() -> {
                User newUser = new User();
                newUser.setEmail(email);
                newUser.setName(nameFromGoogle);
                newUser.setPhone("0000000000");
                newUser.setRole(User.UserRole.CUSTOMER);
                // Random unusable password since Google handles identity
                newUser.setPassword(UUID.randomUUID().toString());
                return userRepository.save(newUser);
            });

            // Backfill old/malformed rows to avoid auth crashes.
            if (user.getRole() == null) {
                user.setRole(User.UserRole.CUSTOMER);
            }
            if (user.getName() == null || user.getName().isBlank()) {
                user.setName(nameFromGoogle);
            }
            if (user.getPhone() == null || user.getPhone().isBlank()) {
                user.setPhone("0000000000");
            }
            user = userRepository.save(user);

            String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name());
            return ResponseEntity.ok(buildAuthResponse(user, token));
        } catch (Exception ex) {
            log.error("Google auth failed", ex);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Google auth failed",
                    "message", ex.getClass().getSimpleName() + ": " +
                            (ex.getMessage() != null ? ex.getMessage() : "Unexpected Google auth error")
            ));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestAttribute Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("name", user.getName());
        response.put("email", user.getEmail());
        response.put("phone", user.getPhone());
        response.put("role", user.getRole());

        return ResponseEntity.ok(response);
    }

    private GoogleIdToken.Payload verifyGoogleIdToken(String idTokenString, List<String> audiences) throws GeneralSecurityException, IOException {
        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), JacksonFactory.getDefaultInstance())
                .setAudience(audiences)
                .build();

        GoogleIdToken idToken = verifier.verify(idTokenString);
        return idToken == null ? null : idToken.getPayload();
    }

    private List<String> getGoogleAudiences() {
        return Arrays.asList(googleWebClientId, googleIosClientId, googleAndroidClientId)
                .stream()
                .map(v -> v == null ? "" : v.trim())
                .filter(v -> !v.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildAuthResponse(User user, String token) {
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "role", user.getRole()
        ));
        return response;
    }

    public static class RegisterRequest {
        private String name;
        private String email;
        private String phone;
        private String password;
        private String role;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPhone() {
            return phone;
        }

        public void setPhone(String phone) {
            this.phone = phone;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
        }
    }

    public static class GoogleAuthRequest {
        private String idToken;

        public String getIdToken() {
            return idToken;
        }

        public void setIdToken(String idToken) {
            this.idToken = idToken;
        }
    }
}
