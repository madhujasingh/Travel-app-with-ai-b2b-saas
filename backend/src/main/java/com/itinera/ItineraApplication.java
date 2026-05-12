package com.itinera;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.net.URI;
import java.net.URISyntaxException;

@SpringBootApplication
public class ItineraApplication {
    public static void main(String[] args) {
        configureDatasourceFromDatabaseUrl();
        SpringApplication.run(ItineraApplication.class, args);
    }

    private static void configureDatasourceFromDatabaseUrl() {
        String databaseUrl = System.getenv("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        if (databaseUrl.startsWith("jdbc:postgresql://")) {
            System.setProperty("spring.datasource.url", databaseUrl);
            return;
        }

        if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
            return;
        }

        try {
            URI uri = new URI(databaseUrl);
            String username = null;
            String password = null;
            if (uri.getUserInfo() != null) {
                String[] credentials = uri.getUserInfo().split(":", 2);
                username = credentials.length > 0 ? credentials[0] : null;
                password = credentials.length > 1 ? credentials[1] : null;
            }

            StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                    .append(uri.getHost());

            if (uri.getPort() != -1) {
                jdbcUrl.append(':').append(uri.getPort());
            }

            jdbcUrl.append(uri.getPath());

            if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
                jdbcUrl.append('?').append(uri.getQuery());
            }

            System.setProperty("spring.datasource.url", jdbcUrl.toString());
            if (username != null && !username.isBlank()) {
                System.setProperty("spring.datasource.username", username);
            }
            if (password != null && !password.isBlank()) {
                System.setProperty("spring.datasource.password", password);
            }
        } catch (URISyntaxException ex) {
            throw new IllegalStateException("Invalid DATABASE_URL", ex);
        }
    }
}
