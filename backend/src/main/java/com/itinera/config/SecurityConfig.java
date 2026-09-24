package com.itinera.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

    // Comma-separated list, from CORS_ALLOWED_ORIGINS. Must be explicit
    // origins rather than "*": allowCredentials(true) makes a wildcard
    // illegal, and the browser rejects the response outright.
    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

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
                .requestMatchers(HttpMethod.GET, "/activities/segments/**").permitAll()
                // Reveals bookings across ALL customers, not just the caller's
                // own - admin-only, and must precede the catch-all below.
                .requestMatchers("/activities/admin/**").hasRole("ADMIN")
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
                // Same no-money-moved reasoning as search/review above - this
                // just prices a route across a date window, doesn't book or
                // reveal anything account-specific, and is used right on the
                // search form before a customer has necessarily signed in.
                .requestMatchers(HttpMethod.POST, "/flights/fare-calendar").permitAll()
                .requestMatchers("/flights/**").authenticated()
                // Persisted flight bookings are account-scoped (ownership enforced
                // in FlightBookingController/-Service) - unlike the TripJack
                // passthrough endpoints above, these need a real logged-in user.
                .requestMatchers("/flight-bookings/**").authenticated()
                .requestMatchers("/activity-bookings/**").authenticated()
                .requestMatchers("/cab-bookings/**").authenticated()
                .requestMatchers("/hotel-bookings/**").authenticated()
                // Cabs is UAT/certification only (see CabsService/TripJackClient) -
                // every endpoint, including quotes, requires auth, unlike flights/
                // hotels' public discovery split, since even a "search" here runs
                // against a real TripJack account's test key.
                .requestMatchers("/cabs/**").authenticated()
                .requestMatchers("/tripsafe-bookings/**").authenticated()
                // TripSafe is also UAT/certification only (see
                // TripSafeService/TripJackClient) - same rationale as Cabs above.
                .requestMatchers("/tripsafe/**").authenticated()
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
                // Read by every price-breakdown screen (flight cart, booking
                // form) - public. Only an admin can change the fee itself.
                .requestMatchers(HttpMethod.GET, "/platform-settings").permitAll()
                .requestMatchers(HttpMethod.PUT, "/platform-settings/**").hasRole("ADMIN")
                // Must precede the public GET below, which would otherwise
                // match it: the admin listing returns inactive packages too.
                // @PreAuthorize guards the method as well - this is the URL
                // rule agreeing with it rather than contradicting it.
                .requestMatchers(HttpMethod.GET, "/itineraries/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/itineraries/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/itineraries/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/itineraries/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/itineraries/**").hasRole("ADMIN")
                .requestMatchers("/suppliers/verified").permitAll()
                // Supplier records gate who can register with role=SUPPLIER (see
                // AuthController) - creating/verifying/deleting them (or reading
                // supplier business data like commission rates) must be admin-only.
                .requestMatchers("/suppliers/**").hasRole("ADMIN")
                // Promo banners: the admin listing (all placements, active +
                // inactive) and the AI title-suggestion endpoint (costs a
                // Gemini call) are admin-only; everything else GET
                // (per-placement listing, image bytes) is public display
                // content. Mutations (create/update/delete) are admin-only
                // via the fallback below.
                // Markup rules. Reading them is fine for any signed-in user -
                // the supplier fare is already in the search response we proxy,
                // so the markup reveals nothing new - but only ADMIN may change
                // them. The admin matcher must come first.
                .requestMatchers("/markup/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/markup/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/markup").authenticated()
                .requestMatchers(HttpMethod.POST, "/markup/quote").authenticated()
                .requestMatchers("/markup/**").hasRole("ADMIN")

                // Coupons. The admin subtree is locked to ROLE_ADMIN so a
                // customer token cannot create, edit, delete or even LIST
                // coupons - listing would let codes be harvested. /validate is
                // merely authenticated: it needs a real user to throttle
                // guessing and to enforce the per-customer limit.
                //
                // Ordering matters - the admin matcher must precede the
                // catch-all, since the first match wins.
                .requestMatchers("/coupons/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/coupons/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/coupons/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/coupons/validate").authenticated()
                .requestMatchers("/coupons/**").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET, "/promo-banners/admin").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/promo-banners/*/suggest-title").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/promo-banners/**").permitAll()
                .requestMatchers("/promo-banners/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(
            Arrays.stream(allowedOrigins.split(","))
                  .map(String::trim)
                  .filter(o -> !o.isEmpty())
                  .toList());
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
