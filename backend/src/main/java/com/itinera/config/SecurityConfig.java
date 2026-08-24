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
                // Activities (HotelBeds/HBX Group, separate provider) - only
                // search/details are pre-booking discovery and public; booking
                // confirm/detail/cancel commit the agency account and expose
                // traveller PII, so they fall through to the authenticated()
                // catch-all for /activities/** below.
                .requestMatchers(HttpMethod.POST, "/activities/search").permitAll()
                .requestMatchers(HttpMethod.POST, "/activities/details").permitAll()
                .requestMatchers(HttpMethod.POST, "/activities/details/full").permitAll()
                .requestMatchers(HttpMethod.GET, "/activities/countries/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/activities/destinations/**").permitAll()
                .requestMatchers("/activities/**").authenticated()
                // Only the discovery/pricing phase of the TripJack flight
                // passthrough is public (browsing without an account) - Book,
                // Confirm-Book, Booking Details, Release PNR, Amendments,
                // Ancillaries, Reissue, and User Balance all either move real
                // money against TripJack's production API or reveal a specific
                // booking's traveller PII/PNR by id alone, so they require a
                // real logged-in user. Explicit permitAll entries must come
                // before the catch-all authenticated() below - first match wins.
                .requestMatchers(HttpMethod.POST, "/flights/search").permitAll()
                .requestMatchers(HttpMethod.POST, "/flights/review").permitAll()
                .requestMatchers(HttpMethod.POST, "/flights/fare-rule").permitAll()
                .requestMatchers(HttpMethod.POST, "/flights/seat-map").permitAll()
                .requestMatchers(HttpMethod.POST, "/flights/fare-validate").permitAll()
                .requestMatchers("/flights/**").authenticated()
                // Persisted flight bookings are account-scoped (ownership enforced
                // in FlightBookingController/-Service) - unlike the TripJack
                // passthrough endpoints above, these need a real logged-in user.
                .requestMatchers("/flight-bookings/**").authenticated()
                .requestMatchers("/activity-bookings/**").authenticated()
                // Same split as flights - Listing/Detail/Review/Static-Detail are
                // pre-booking discovery, public; Book/Confirm-Book/Booking
                // Details/Cancel move money or expose a specific booking's PII.
                .requestMatchers(HttpMethod.POST, "/hotels/listing").permitAll()
                .requestMatchers(HttpMethod.POST, "/hotels/detail").permitAll()
                .requestMatchers(HttpMethod.POST, "/hotels/review").permitAll()
                .requestMatchers(HttpMethod.POST, "/hotels/static-detail").permitAll()
                .requestMatchers(HttpMethod.GET, "/hotels/nationalities").permitAll()
                .requestMatchers(HttpMethod.GET, "/hotels/countries").permitAll()
                .requestMatchers(HttpMethod.GET, "/hotels/city-region-ids").permitAll()
                .requestMatchers(HttpMethod.POST, "/hotels/hotel-mapping").permitAll()
                .requestMatchers(HttpMethod.POST, "/hotels/hotel-content").permitAll()
                .requestMatchers(HttpMethod.POST, "/hotels/hotel-mapping-sync").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotels/deleted-hotel-mapping").hasRole("ADMIN")
                .requestMatchers("/hotels/**").authenticated()
                // Syncing costs real TripJack API calls and writes to our DB -
                // admin-triggered only. Reading the cached catalog is public,
                // same as /hotels/** above.
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/sync").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/sync-country").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/sync-city").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/sync-global-delta").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/cleanup-deleted-hotels").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/hotel-catalog/sync-jobs/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/cleanup-heavy-content").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/hotel-catalog/vacuum").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/hotel-catalog/storage-stats").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/hotel-catalog/cities").hasRole("ADMIN")
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
