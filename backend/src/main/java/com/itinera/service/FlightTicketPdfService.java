package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.pdf417.PDF417Writer;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.Map;

// Renders the MoCA-mandated itinerary PDF: passenger/flight details plus one
// PDF417 "2D Barcode" per passenger per journey leg (never per booking, and
// never for infants - see BoardingPassBarcodeBuilder and
// project_flight_ticket_barcode_pending memory for the full spec this
// implements). Request shape is a plain JsonNode - same convention as
// FlightService/ActivitiesService rather than TripJack's own raw payloads,
// since the frontend already has these fields parsed out for display and
// re-deriving them from TripJack's booking-details response here would
// duplicate parsing logic that already exists on the client.
@Service
public class FlightTicketPdfService {

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter DISPLAY_TIME = DateTimeFormatter.ofPattern("HH:mm");

    public byte[] generate(JsonNode request) {
        String bookingReference = request.path("bookingReference").asText("");
        String agencyName = request.path("agencyName").asText("Itinera Travels");

        try {
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            PdfWriter.getInstance(document, output);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.BLACK);
            Font agencyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.BLACK);
            Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY);
            Font barcodeCaptionFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.BLACK);

            Paragraph agency = new Paragraph(agencyName, agencyFont);
            document.add(agency);

            Paragraph title = new Paragraph("Flight Itinerary", titleFont);
            title.setSpacingAfter(4);
            document.add(title);

            if (!bookingReference.isEmpty()) {
                Paragraph ref = new Paragraph("Booking Reference: " + bookingReference, labelFont);
                ref.setSpacingAfter(16);
                document.add(ref);
            }

            for (JsonNode passenger : request.path("passengers")) {
                String title2 = passenger.path("title").asText("");
                String firstName = passenger.path("firstName").asText("");
                String lastName = passenger.path("lastName").asText("");

                Paragraph passengerHeader = new Paragraph(
                        String.format("%s %s %s", title2, firstName, lastName).trim(), sectionFont);
                passengerHeader.setSpacingBefore(10);
                passengerHeader.setSpacingAfter(6);
                document.add(passengerHeader);

                for (JsonNode leg : passenger.path("legs")) {
                    document.add(buildLegTable(leg));

                    String pnr = leg.path("pnr").asText("");
                    LocalDate flightDate = parseDate(leg.path("date").asText(null));

                    String barcodeText = BoardingPassBarcodeBuilder.build(
                            lastName,
                            firstName,
                            pnr,
                            leg.path("from").asText(""),
                            leg.path("to").asText(""),
                            leg.path("carrierCode").asText(""),
                            leg.path("flightNumber").asText(""),
                            flightDate
                    );

                    Paragraph caption = new Paragraph("Your Airline Reference: " + pnr, barcodeCaptionFont);
                    caption.setSpacingBefore(8);
                    document.add(caption);

                    Image barcodeImage = renderBarcode(barcodeText);
                    barcodeImage.setSpacingAfter(20);
                    document.add(barcodeImage);
                }
            }

            document.close();
            return output.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate flight ticket PDF", e);
        }
    }

    private PdfPTable buildLegTable(JsonNode leg) {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY);
        Font valueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.BLACK);

        String airlineName = leg.path("airlineName").asText("");
        String carrierCode = leg.path("carrierCode").asText("");
        String flightNumber = leg.path("flightNumber").asText("");
        String from = leg.path("from").asText("");
        String to = leg.path("to").asText("");
        LocalDateTime departure = parseDateTime(leg.path("departureTime").asText(null));
        LocalDateTime arrival = parseDateTime(leg.path("arrivalTime").asText(null));

        addRow(table, labelFont, valueFont, "Flight", airlineName + " " + carrierCode + flightNumber);
        addRow(table, labelFont, valueFont, "Route", from + " -> " + to);
        addRow(table, labelFont, valueFont, "Departure", formatDateTime(departure));
        addRow(table, labelFont, valueFont, "Arrival", formatDateTime(arrival));
        return table;
    }

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

    private Image renderBarcode(String barcodeText) throws Exception {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 0);
        BitMatrix matrix = new PDF417Writer().encode(barcodeText, BarcodeFormat.PDF_417, 300, 80, hints);

        ByteArrayOutputStream pngOutput = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", pngOutput);

        Image image = Image.getInstance(pngOutput.toByteArray());
        image.scaleToFit(260, 70);
        image.setAlignment(Element.ALIGN_LEFT);
        return image;
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.length() >= 10 ? value.substring(0, 10) : value);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.length() > 19 ? value.substring(0, 19) : value);
        } catch (Exception e) {
            return null;
        }
    }

    private String formatDateTime(LocalDateTime value) {
        if (value == null) {
            return "-";
        }
        return value.format(DISPLAY_DATE) + " " + value.format(DISPLAY_TIME);
    }
}
