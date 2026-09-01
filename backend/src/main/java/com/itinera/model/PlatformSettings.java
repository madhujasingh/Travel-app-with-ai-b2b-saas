package com.itinera.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

// Single-row table (id is always 1) for platform-wide settings an admin can
// tune without a redeploy - starts with just the flight convenience fee, but
// the shape leaves room to add more fields later without a rename.
@Entity
@Table(name = "platform_settings")
@Data
@NoArgsConstructor
public class PlatformSettings {

    @Id
    private Long id = 1L;

    // Flat fee (INR) added on top of the flight fare at checkout, charged by
    // us on our own payment rail - never sent to TripJack, whose Book/
    // Confirm-Book paymentInfos.amount must equal exactly the reviewed fare
    // (+ SSR), or it 400s with errCode 1015.
    private Double flightConvenienceFee = 300.0;
}
