package com.itinera.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Context path is already /api, so matchers should use app-relative routes.
                // Must come before the /auth/** permitAll below - first match wins.
                .requestMatchers(HttpMethod.PUT, "/auth/change-password").authenticated()
                .requestMatchers(HttpMethod.PUT, "/auth/profile").authenticated()
                .requestMatchers("/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/ai/**").permitAll()
                .requestMatchers("/flights/**").permitAll()
                // Persisted flight bookings are account-scoped (ownership enforced
                // in FlightBookingController/-Service) - unlike the TripJack
                // passthrough endpoints above, these need a real logged-in user.
                .requestMatchers("/flight-bookings/**").authenticated()
                .requestMatchers("/hotels/**").permitAll()
                // Syncing costs real TripJack API calls and writes to our DB -
                // admin-triggered only. Reading the cached catalog is public,
                // same as /hotels/** above.
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/sync").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/sync-country").hasRole("ADMIN")
                .requestMatchers("/hotel-catalog/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/itineraries/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/itineraries/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/itineraries/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/itineraries/**").hasRole("ADMIN")
                .requestMatchers("/suppliers/verified").permitAll()
                // Supplier records gate who can register with role=SUPPLIER (see
                // AuthController) - creating/verifying/deleting them (or reading
                // supplier business data like commission rates) must be admin-only.
                .requestMatchers("/suppliers/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(
            "http://localhost:19006",
            "http://localhost:8081",
            "exp://localhost:19000"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
