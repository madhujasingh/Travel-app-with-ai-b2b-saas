package com.itinera.controller;

import com.itinera.model.MarkupRule;
import com.itinera.service.MarkupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

// Admin-managed markup rules, plus a read endpoint the app uses to show the
// selling price.
//
// The rules themselves are not a secret - the customer already receives the
// supplier's fare in the search response we proxy, so exposing the markup to an
// authenticated app does not reveal anything new. Only ADMIN can change them.
@RestController
@RequestMapping("/markup")
public class MarkupController {

    private final MarkupService markupService;

    public MarkupController(MarkupService markupService) {
        this.markupService = markupService;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(markupService.listAll());
    }

    @PutMapping("/admin")
    public ResponseEntity<?> upsert(@RequestBody MarkupRule rule) {
        try {
            return ResponseEntity.ok(markupService.upsert(rule));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/admin/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        markupService.delete(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // What we would add to a given supplier fare. Used by the app to show a
    // selling price, and by admins browsing the storefront to see the split.
    @PostMapping("/quote")
    public ResponseEntity<?> quote(@RequestBody Map<String, Object> body) {
        String service = String.valueOf(body.getOrDefault("service", ""));
        String category = body.get("category") == null ? "DEFAULT" : String.valueOf(body.get("category"));
        int pax = body.get("paxCount") == null ? 1 : Integer.parseInt(String.valueOf(body.get("paxCount")));
        String entityKey = body.get("entityKey") == null ? "" : String.valueOf(body.get("entityKey"));
        BigDecimal base;
        try {
            base = new BigDecimal(String.valueOf(body.getOrDefault("baseAmount", "0")));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid base amount."));
        }

        BigDecimal markup = markupService.markupFor(service, category, entityKey, base, pax);
        return ResponseEntity.ok(Map.of(
                "baseAmount", base,
                "markupAmount", markup,
                "sellingAmount", base.add(markup)
        ));
    }
}
