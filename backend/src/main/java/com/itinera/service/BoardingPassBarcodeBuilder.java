package com.itinera.service;

import java.time.LocalDate;

// Builds the 60-character IATA BCBP-style "M1" barcode string TripJack's
// "Flights 2D Barcode User Guide" (Ministry of Civil Aviation mandate)
// requires on every itinerary/ticket - one string per passenger per journey
// leg (never per booking - a 2-pax return trip needs 4 strings, not 2; no
// barcode for infants). This class only builds the string; FlightTicketPdfService
// renders it as an actual PDF417 image.
//
// Field layout (exact spec, 60 chars total):
// FormatCode(1,"M") + NumLegs(1,"1") + PassengerName(20) + ElectronicTicketIndicator(1," ")
// + OperatingCarrierPnr(7) + FromAirport(3) + ToAirport(3) + CarrierDesignator(3)
// + FlightNumber(5) + JulianDate(3) + CompartmentCode(1,"Y") + SeatNumber(4,"0000")
// + CheckinSequence(5,"00000") + PassengerStatus(1,"0") + FieldSizeVariable(2,"00")
public final class BoardingPassBarcodeBuilder {

    private BoardingPassBarcodeBuilder() {
    }

    public static String build(
            String lastName,
            String firstName,
            String pnr,
            String fromAirport,
            String toAirport,
            String carrierCode,
            String flightNumber,
            LocalDate flightDate
    ) {
        StringBuilder sb = new StringBuilder(60);
        sb.append('M');
        sb.append('1');
        sb.append(passengerName(lastName, firstName));
        sb.append(' ');
        sb.append(padRight(nullToEmpty(pnr), 7));
        sb.append(padRight(nullToEmpty(fromAirport), 3));
        sb.append(padRight(nullToEmpty(toAirport), 3));
        sb.append(padRight(nullToEmpty(carrierCode), 3));
        sb.append(flightNumberField(flightNumber));
        sb.append(julianDate(flightDate));
        sb.append('Y');
        sb.append("0000");
        sb.append("00000");
        sb.append('0');
        sb.append("00");
        return sb.toString();
    }

    // "<Last Name>/<FirstName><MiddleName>", trimmed to 20 chars if longer,
    // right-padded with spaces if shorter.
    private static String passengerName(String lastName, String firstName) {
        String raw = nullToEmpty(lastName).trim().toUpperCase() + "/" + nullToEmpty(firstName).trim().toUpperCase();
        if (raw.length() > 20) {
            return raw.substring(0, 20);
        }
        return padRight(raw, 20);
    }

    // Zero-padded to 4 digits (leading zeros), then right-padded with spaces
    // to reach 5 characters - matches the spec's own examples exactly:
    // 1->"0001 ", 11->"0011 ", 111->"0111 ", 1111->"1111 ", 11111->"11111".
    private static String flightNumberField(String flightNumber) {
        String digitsOnly = nullToEmpty(flightNumber).replaceAll("\\D", "");
        String zeroPadded = digitsOnly.length() >= 4 ? digitsOnly : "0".repeat(4 - digitsOnly.length()) + digitsOnly;
        return padRight(zeroPadded, 5);
    }

    // Last 3 digits of the Julian date (YYDDD) - i.e. just DDD, the
    // zero-padded day-of-year. Verified against the spec's own worked
    // example: 01-May-2023 -> Julian 23121 -> field "121" (day 121 of 2023).
    private static String julianDate(LocalDate date) {
        if (date == null) {
            return "000";
        }
        return String.format("%03d", date.getDayOfYear());
    }

    private static String padRight(String value, int length) {
        if (value.length() >= length) {
            return value.substring(0, length);
        }
        return value + " ".repeat(length - value.length());
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
