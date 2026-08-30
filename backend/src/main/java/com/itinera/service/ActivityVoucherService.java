package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

// Activity vouchers - see the activities-knowledge-base "Voucher Generation"
// doc. HotelBeds' confirm/booking-detail response sometimes returns a
// "vouchers[]" array (activities with a direct supplier barcode/QR
// integration) - when present, that PDF/HTML MUST be handed to the customer
// as-is; generating our own for those is explicitly disallowed ("will cause
// operational issues", per the doc) since it lacks the supplier's own
// QR/barcode identification. Only when vouchers[] is absent do we generate
// our own, from the mandatory field list the same doc specifies.
@Service
public class ActivityVoucherService {

    private final ActivitiesService activitiesService;

    public ActivityVoucherService(ActivitiesService activitiesService) {
        this.activitiesService = activitiesService;
    }

    public Map<String, Object> resolveVoucher(String language, String reference) {
        JsonNode activity = firstActivity(bookingDetail(language, reference));
        JsonNode vouchers = activity.path("vouchers");

        Map<String, Object> result = new HashMap<>();
        if (vouchers.isArray() && !vouchers.isEmpty()) {
            JsonNode first = vouchers.get(0);
            result.put("hasSupplierVoucher", true);
            result.put("url", first.path("url").asText(null));
            result.put("mimeType", first.path("mimeType").asText(null));
        } else {
            result.put("hasSupplierVoucher", false);
        }
        return result;
    }

    public byte[] generatePdf(String language, String reference) {
        JsonNode detail = bookingDetail(language, reference);
        JsonNode booking = detail.path("booking");
        JsonNode activity = firstActivity(detail);

        if (activity.path("vouchers").isArray() && !activity.path("vouchers").isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This booking has a supplier-provided voucher - use that instead of generating one"
            );
        }

        try {
            Document document = new Document(PageSize.A4, 40, 40, 40, 40);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            PdfWriter.getInstance(document, output);
            document.open();

            Font agencyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.BLACK);
            Font refFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(0xD6, 0x4E, 0x13));
            Font activityNameFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, Color.BLACK);
            Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.GRAY);
            Font valueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, Color.BLACK);
            Font remarksFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.BLACK);

            document.add(new Paragraph("MyItenary Travels", agencyFont));
            Paragraph title = new Paragraph("Activity Voucher", titleFont);
            title.setSpacingAfter(4);
            document.add(title);

            Paragraph referenceLine = new Paragraph("Reference: " + booking.path("reference").asText(""), refFont);
            referenceLine.setSpacingAfter(12);
            document.add(referenceLine);

            Paragraph activityName = new Paragraph(activity.path("name").asText(""), activityNameFont);
            activityName.setSpacingAfter(10);
            document.add(activityName);

            PdfPTable table = new PdfPTable(2);
            table.setWidthPercentage(100);
            table.setSpacingAfter(14);

            addRow(table, labelFont, valueFont, "Modality", activity.path("modality").path("name").asText(""));
            String activityLanguage = firstLanguage(activity);
            if (!activityLanguage.isEmpty()) {
                addRow(table, labelFont, valueFont, "Language", activityLanguage);
            }
            addRow(table, labelFont, valueFont, "From", activity.path("dateFrom").asText(""));
            addRow(table, labelFont, valueFont, "To", activity.path("dateTo").asText(""));
            addRow(table, labelFont, valueFont, "Passenger", holderName(booking));
            addRow(table, labelFont, valueFont, "Booking Confirmed", booking.path("creationDate").asText(""));
            addRow(table, labelFont, valueFont, "Pax Distribution", paxSummary(activity));

            String destination = destinationName(activity);
            if (!destination.isEmpty()) {
                addRow(table, labelFont, valueFont, "Destination", destination);
            }

            String providerName = activity.path("providerInformation").path("name").asText("");
            String providerBookingRef = activity.path("providerInformation").path("bookingReference").asText("");
            if (!providerName.isEmpty()) {
                addRow(table, labelFont, valueFont, "Provider",
                        providerName + (providerBookingRef.isEmpty() ? "" : " (Confirmation: " + providerBookingRef + ")"));
            }

            String supplierName = activity.path("supplier").path("name").asText("");
            String supplierVat = activity.path("supplier").path("vatNumber").asText("");
            if (!supplierName.isEmpty()) {
                addRow(table, labelFont, valueFont, "Bookable & Payable Thru",
                        supplierName + (supplierVat.isEmpty() ? "" : " (VAT: " + supplierVat + ")"));
            }

            document.add(table);

            String remarks = contractRemarks(activity);
            if (!remarks.isEmpty()) {
                Paragraph remarksLabel = new Paragraph("Redeem Instructions / Remarks", labelFont);
                remarksLabel.setSpacingBefore(6);
                document.add(remarksLabel);
                // Suppliers concatenate distinct segments (meeting point, schedule,
                // voucher type, restrictions...) using "//" as a delimiter - split
                // back out into bullet points instead of one dense paragraph.
                for (String line : remarks.split("\\n|//")) {
                    String trimmed = decodeHtmlText(line.trim());
                    if (!trimmed.isEmpty()) {
                        document.add(new Paragraph("\u2022 " + trimmed, remarksFont));
                    }
                }
            }

            document.close();
            return output.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate activity voucher PDF", e);
        }
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

    private String holderName(JsonNode booking) {
        JsonNode holder = booking.path("holder");
        String title = holder.path("title").asText("");
        String name = holder.path("name").asText("");
        String surname = holder.path("surname").asText("");
        return (title + " " + name + " " + surname).trim().replaceAll("\\s+", " ");
    }

    // "AD"/"CH" per the confirm response's paxType enum (distinct from the
    // request's "ADULT"/"CHILD"/"CHILDREN" - see booking confirm.txt).
    private String paxSummary(JsonNode activity) {
        int adults = 0;
        int children = 0;
        StringBuilder childAges = new StringBuilder();

        Iterator<JsonNode> paxes = activity.path("paxes").elements();
        while (paxes.hasNext()) {
            JsonNode pax = paxes.next();
            String paxType = pax.path("paxType").asText("");
            if ("CH".equalsIgnoreCase(paxType)) {
                children++;
                if (childAges.length() > 0) childAges.append(", ");
                childAges.append(pax.path("age").asInt());
            } else {
                adults++;
            }
        }

        StringBuilder summary = new StringBuilder(adults + " Adult" + (adults == 1 ? "" : "s"));
        if (children > 0) {
            summary.append(", ").append(children).append(" Child").append(children == 1 ? "" : "ren");
            summary.append(" (Age").append(children == 1 ? "" : "s").append(": ").append(childAges).append(")");
        }
        return summary.toString();
    }

    // Only present "in case the activity has a language to select" (per
    // booking confirm.txt) - nested three levels deep under the same
    // modality/rates/rateDetails shape the Detail call uses.
    // HotelBeds' free-text fields carry raw HTML fragments - <br>/</br> (both
    // forms show up in their own docs) and &nbsp; runs used as informal
    // spacing - strip them so the PDF never shows literal "&nbsp;" text.
    private String decodeHtmlText(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        return text
                .replaceAll("(?i)</?br\\s*/?>", " ")
                .replaceAll("(?i)</?strong>", "")
                .replaceAll("<[^>]+>", "")
                .replaceAll("(?i)&nbsp;", " ")
                .replaceAll("(?i)&amp;", "&")
                .replaceAll("(?i)&quot;", "\"")
                .replaceAll("(?i)&#39;|&apos;", "'")
                .replaceAll("(?i)&lt;", "<")
                .replaceAll("(?i)&gt;", ">")
                .replaceAll("\\s{2,}", " ")
                .trim();
    }

    private String firstLanguage(JsonNode activity) {
        Iterator<JsonNode> rates = activity.path("modality").path("rates").elements();
        while (rates.hasNext()) {
            Iterator<JsonNode> rateDetails = rates.next().path("rateDetails").elements();
            while (rateDetails.hasNext()) {
                JsonNode languages = rateDetails.next().path("languages");
                if (languages.isArray() && !languages.isEmpty()) {
                    JsonNode lang = languages.get(0);
                    String name = lang.path("name").asText("");
                    if (!name.isEmpty()) return name;
                    String code = lang.path("code").asText("");
                    if (!code.isEmpty()) return code.toUpperCase();
                }
            }
        }
        return "";
    }

    private String destinationName(JsonNode activity) {
        JsonNode destinations = activity.path("contactInfo").path("country").path("destinations");
        if (destinations.isArray() && !destinations.isEmpty()) {
            return destinations.get(0).path("name").asText("");
        }
        return "";
    }

    private String contractRemarks(JsonNode activity) {
        StringBuilder remarks = new StringBuilder();
        Iterator<JsonNode> comments = activity.path("comments").elements();
        while (comments.hasNext()) {
            JsonNode comment = comments.next();
            if ("CONTRACT_REMARKS".equals(comment.path("type").asText())) {
                if (remarks.length() > 0) remarks.append("\n");
                remarks.append(comment.path("text").asText(""));
            }
        }
        return remarks.toString();
    }

    private JsonNode firstActivity(JsonNode detail) {
        JsonNode activities = detail.path("booking").path("activities");
        if (!activities.isArray() || activities.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No activity found on this booking");
        }
        return activities.get(0);
    }

    private JsonNode bookingDetail(String language, String reference) {
        return activitiesService.bookingDetail(language, reference);
    }
}
