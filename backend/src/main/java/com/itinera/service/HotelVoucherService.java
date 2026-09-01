package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Iterator;

// Renders our own hotel booking voucher PDF from TripJack's booking-details
// response (see hotel-v2/v2-doc.md, "oms/v3/hotel/booking-details"). Unlike
// activities (see ActivityVoucherService), TripJack's hotel API has no
// supplier-provided voucher field to resolve first - every hotel booking
// gets a voucher we generate ourselves, same as flights.
@Service
public class HotelVoucherService {

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final HotelService hotelService;

    public HotelVoucherService(HotelService hotelService) {
        this.hotelService = hotelService;
    }

    public byte[] generatePdf(String bookingId) {
        JsonNode payload = OBJECT_MAPPER.createObjectNode().put("bookingId", bookingId);
        JsonNode detail = hotelService.bookingDetails(payload);

        JsonNode order = detail.path("order");
        JsonNode hInfo = detail.path("itemInfos").path("HOTEL").path("hInfo");
        JsonNode query = detail.path("itemInfos").path("HOTEL").path("query");
        JsonNode option = firstOption(hInfo);

        try {
            Document document = new Document(PageSize.A4, 40, 40, 40, 40);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            PdfWriter.getInstance(document, output);
            document.open();

            Font agencyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.BLACK);
            Font statusFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, new Color(0x1E, 0x8E, 0x3E));
            Font refFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(0xD6, 0x4E, 0x13));
            Font hotelNameFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
            Font addressFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.BLACK);
            Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY);
            Font valueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.BLACK);
            Font termsFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);
            Font tableHeaderFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.BLACK);
            Font tableCellFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);

            document.add(new Paragraph("MyItineri Travels", agencyFont));
            Paragraph title = new Paragraph("Hotel Voucher", titleFont);
            title.setSpacingAfter(4);
            document.add(title);

            document.add(new Paragraph(statusLabel(order.path("status").asText("")), statusFont));

            Paragraph referenceLine = new Paragraph("Booking ID: " + order.path("bookingId").asText(""), refFont);
            referenceLine.setSpacingAfter(2);
            document.add(referenceLine);

            String confirmationNumber = detail.path("hotelConfirmationNumber").asText("");
            if (!confirmationNumber.isEmpty()) {
                Paragraph confirmationLine = new Paragraph("Hotel Confirmation No: " + confirmationNumber, labelFont);
                confirmationLine.setSpacingAfter(12);
                document.add(confirmationLine);
            }

            Paragraph hotelName = new Paragraph(hotelName(hInfo), hotelNameFont);
            hotelName.setSpacingAfter(2);
            document.add(hotelName);
            document.add(new Paragraph(hotelAddress(hInfo), addressFont));

            Paragraph stayHeading = new Paragraph("Stay Details", sectionFont);
            stayHeading.setSpacingBefore(14);
            stayHeading.setSpacingAfter(6);
            document.add(stayHeading);

            String checkinDate = query.path("checkinDate").asText("");
            String checkoutDate = query.path("checkoutDate").asText("");
            int rooms = roomCount(option);
            int[] guestCounts = guestCounts(option);

            PdfPTable stayTable = new PdfPTable(2);
            stayTable.setWidthPercentage(100);
            stayTable.setSpacingAfter(14);
            addRow(stayTable, labelFont, valueFont, "Check in", formatDate(checkinDate));
            addRow(stayTable, labelFont, valueFont, "Check out", formatDate(checkoutDate));
            addRow(stayTable, labelFont, valueFont, "Total Nights", String.valueOf(nights(checkinDate, checkoutDate)));
            addRow(stayTable, labelFont, valueFont, "Total Rooms", String.valueOf(rooms));
            addRow(stayTable, labelFont, valueFont, "Total Guests", guestSummary(guestCounts));
            document.add(stayTable);

            Paragraph roomsHeading = new Paragraph("Room Details", sectionFont);
            roomsHeading.setSpacingAfter(6);
            document.add(roomsHeading);

            Iterator<JsonNode> roomList = option.path("ris").elements();
            int roomIndex = 1;
            while (roomList.hasNext()) {
                JsonNode room = roomList.next();
                Paragraph roomHeader = new Paragraph(
                        "Room " + roomIndex + ": " + roomTypeName(room), valueFont);
                roomHeader.setSpacingBefore(4);
                document.add(roomHeader);

                String mealBasis = room.path("mb").asText("");
                if (!mealBasis.isEmpty()) {
                    document.add(new Paragraph("Includes: " + mealBasis, labelFont));
                }
                document.add(new Paragraph("Guests: " + guestNames(room), labelFont));
                roomIndex++;
            }

            JsonNode cancellationPolicy = option.path("cnp");
            if (cancellationPolicy.path("pd").isArray() && !cancellationPolicy.path("pd").isEmpty()) {
                Paragraph cancellationHeading = new Paragraph("Cancellation Policy", sectionFont);
                cancellationHeading.setSpacingBefore(14);
                cancellationHeading.setSpacingAfter(6);
                document.add(cancellationHeading);

                PdfPTable cancellationTable = new PdfPTable(3);
                cancellationTable.setWidthPercentage(100);
                cancellationTable.setSpacingAfter(14);
                addHeaderCell(cancellationTable, tableHeaderFont, "Cancellation on or After");
                addHeaderCell(cancellationTable, tableHeaderFont, "Cancellation on or Before");
                addHeaderCell(cancellationTable, tableHeaderFont, "Cancellation Charges");

                String currency = option.path("sc").asText("INR");
                Iterator<JsonNode> penalties = cancellationPolicy.path("pd").elements();
                while (penalties.hasNext()) {
                    JsonNode penalty = penalties.next();
                    addCell(cancellationTable, tableCellFont, formatDate(penalty.path("fdt").asText("")));
                    addCell(cancellationTable, tableCellFont, formatDate(penalty.path("tdt").asText("")));
                    addCell(cancellationTable, tableCellFont,
                            currency + " " + String.format("%,.2f", penalty.path("am").asDouble(0)));
                }
                document.add(cancellationTable);
            }

            Paragraph termsHeading = new Paragraph("General Terms & Conditions", sectionFont);
            termsHeading.setSpacingAfter(6);
            document.add(termsHeading);
            for (String term : GENERAL_TERMS) {
                document.add(new Paragraph("• " + term, termsFont));
            }

            Paragraph fareHeading = new Paragraph("Fare Summary", sectionFont);
            fareHeading.setSpacingBefore(14);
            fareHeading.setSpacingAfter(6);
            document.add(fareHeading);

            double totalPrice = option.path("tp").asDouble(0);
            double taxes = option.path("gst_appl_amt").asDouble(0);
            double baseFare = totalPrice - taxes;
            String currency = option.path("sc").asText("INR");

            PdfPTable fareTable = new PdfPTable(2);
            fareTable.setWidthPercentage(100);
            addRow(fareTable, labelFont, valueFont, "Base Fare", currency + " " + String.format("%,.2f", baseFare));
            addRow(fareTable, labelFont, valueFont, "Taxes and fees", currency + " " + String.format("%,.2f", taxes));
            addRow(fareTable, labelFont, valueFont, "Total Amount Payable", currency + " " + String.format("%,.2f", totalPrice));
            document.add(fareTable);

            document.close();
            return output.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate hotel voucher PDF", e);
        }
    }

    private static final String[] GENERAL_TERMS = {
            "This booking is confirmed; your name will be listed in the hotel's reservation system closer to your arrival date.",
            "Guest photo ID must be presented at the time of check-in.",
            "A credit card or cash deposit may be required for extra services at the time of check-in.",
            "Extra-person and/or extra-bed charges may apply and vary depending on property policy.",
            "Special requests (bed type, smoking room, early check-in, late check-out, etc.) are subject to availability and not guaranteed at the time of booking.",
            "Full cancellation charges are applicable on early check-out unless otherwise specified.",
            "City tax and resort fee (if any) are to be paid directly to the hotel.",
            "As per RBI guidelines, foreign nationals must submit a valid passport copy; failure to comply may result in cancellation of the booking without notice.",
            "Any additional GST payment (if any) is to be paid to the hotel directly by the guest.",
    };

    private void addRow(PdfPTable table, Font labelFont, Font valueFont, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Paragraph(label, labelFont));
        labelCell.setBorder(0);
        labelCell.setPaddingBottom(2);
        PdfPCell valueCell = new PdfPCell(new Paragraph(value, valueFont));
        valueCell.setBorder(0);
        valueCell.setPaddingBottom(2);
        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    private void addHeaderCell(PdfPTable table, Font font, String text) {
        PdfPCell cell = new PdfPCell(new Paragraph(text, font));
        cell.setBackgroundColor(new Color(0xF0, 0xF0, 0xF0));
        cell.setPadding(5);
        table.addCell(cell);
    }

    private void addCell(PdfPTable table, Font font, String text) {
        PdfPCell cell = new PdfPCell(new Paragraph(text, font));
        cell.setPadding(5);
        table.addCell(cell);
    }

    private String statusLabel(String status) {
        switch (status) {
            case "SUCCESS":
                return "Booking Confirmed";
            case "ON_HOLD":
                return "Booking On Hold";
            case "CANCELLED":
                return "Booking Cancelled";
            case "CANCELLATION_PENDING":
                return "Cancellation Pending";
            default:
                return status.isEmpty() ? "" : status;
        }
    }

    // hInfo.ops[] holds one entry per booked rate option - the booking flow
    // only ever books a single option per booking (see HotelBookingScreen),
    // though that option can span multiple rooms via ris[].
    private JsonNode firstOption(JsonNode hInfo) {
        JsonNode ops = hInfo.path("ops");
        return ops.isArray() && !ops.isEmpty() ? ops.get(0) : OBJECT_MAPPER.createObjectNode();
    }

    private String hotelName(JsonNode hInfo) {
        String name = hInfo.path("name").asText("");
        int rating = hInfo.path("rt").asInt(0);
        if (rating <= 0) {
            return name;
        }
        StringBuilder stars = new StringBuilder();
        for (int i = 0; i < rating; i++) {
            stars.append("★");
        }
        return name + "  " + stars;
    }

    private String hotelAddress(JsonNode hInfo) {
        JsonNode address = hInfo.path("ad");
        StringBuilder line = new StringBuilder(address.path("adr").asText(""));
        String city = address.path("city").path("name").asText("");
        String state = address.path("state").path("name").asText("");
        String country = address.path("country").path("name").asText("");
        String postalCode = address.path("postalCode").asText("");
        for (String part : new String[]{city, state, country}) {
            if (!part.isEmpty()) {
                if (line.length() > 0) line.append(", ");
                line.append(part);
            }
        }
        if (!postalCode.isEmpty()) {
            line.append(" - ").append(postalCode);
        }
        return line.toString();
    }

    private int roomCount(JsonNode option) {
        int count = 0;
        Iterator<JsonNode> rooms = option.path("ris").elements();
        while (rooms.hasNext()) {
            rooms.next();
            count++;
        }
        return count;
    }

    private int[] guestCounts(JsonNode option) {
        int adults = 0;
        int children = 0;
        Iterator<JsonNode> rooms = option.path("ris").elements();
        while (rooms.hasNext()) {
            JsonNode room = rooms.next();
            adults += room.path("adt").asInt(0);
            children += room.path("chd").asInt(0);
        }
        return new int[]{adults, children};
    }

    private String guestSummary(int[] guestCounts) {
        int adults = guestCounts[0];
        int children = guestCounts[1];
        StringBuilder summary = new StringBuilder(adults + " Adult" + (adults == 1 ? "" : "s"));
        if (children > 0) {
            summary.append(", ").append(children).append(" Child").append(children == 1 ? "" : "ren");
        }
        return summary.toString();
    }

    private String roomTypeName(JsonNode room) {
        String standardName = room.path("srn").asText("");
        if (!standardName.isEmpty()) {
            return standardName;
        }
        return room.path("rc").asText(room.path("rt").asText(""));
    }

    private String guestNames(JsonNode room) {
        StringBuilder names = new StringBuilder();
        Iterator<JsonNode> travelers = room.path("ti").elements();
        while (travelers.hasNext()) {
            JsonNode traveler = travelers.next();
            String name = (traveler.path("ti").asText("") + " "
                    + traveler.path("fN").asText("") + " "
                    + traveler.path("lN").asText("")).trim().replaceAll("\\s+", " ");
            if (!name.isEmpty()) {
                if (names.length() > 0) names.append(", ");
                names.append(name);
            }
        }
        return names.length() > 0 ? names.toString() : "-";
    }

    // TripJack dates are "yyyy-MM-dd" or "yyyy-MM-dd'T'HH:mm" - the date
    // portion is always the first 10 characters in both cases.
    private String formatDate(String rawDate) {
        if (rawDate == null || rawDate.length() < 10) {
            return rawDate == null ? "" : rawDate;
        }
        try {
            return LocalDate.parse(rawDate.substring(0, 10)).format(DISPLAY_DATE);
        } catch (Exception e) {
            return rawDate;
        }
    }

    private long nights(String checkinDate, String checkoutDate) {
        try {
            return ChronoUnit.DAYS.between(LocalDate.parse(checkinDate), LocalDate.parse(checkoutDate));
        } catch (Exception e) {
            return 0;
        }
    }
}
