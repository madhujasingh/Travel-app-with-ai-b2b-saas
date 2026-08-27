package com.itinera.config;

import com.itinera.model.User;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSeederConfig {

    // Demo accounts have well-known, publicly documented passwords - must never
    // run against production. Defaults to true to preserve local dev behavior;
    // set SEED_DEMO_USERS=false in production environments.
    @Value("${app.seed-demo-users:true}")
    private boolean seedDemoUsers;

    @Bean
    CommandLineRunner seedDefaultData(UserRepository userRepository) {
        return args -> {
            if (seedDemoUsers) {
                createUserIfMissing(
                        userRepository,
                        "customer@itinera.com",
                        "Demo Customer",
                        "9000000001",
                        "Customer@123",
                        User.UserRole.CUSTOMER
                );

                createUserIfMissing(
                        userRepository,
                        "supplier@itinera.com",
                        "Demo Supplier",
                        "9000000002",
                        "Supplier@123",
                        User.UserRole.SUPPLIER
                );

                createUserIfMissing(
                        userRepository,
                        "admin@itinera.com",
                        "Demo Admin",
                        "9000000003",
                        "Admin@123",
                        User.UserRole.ADMIN
                );
            }
        };
    }

    private void createUserIfMissing(
            UserRepository userRepository,
            String email,
            String name,
            String phone,
            String rawPassword,
            User.UserRole role
    ) {
        if (userRepository.existsByEmail(email)) {
            return;
        }

        User user = new User();
        user.setEmail(email);
        user.setName(name);
        user.setPhone(phone);
        user.setRole(role);
        user.setPassword(rawPassword);
        userRepository.save(user);
    }
}
