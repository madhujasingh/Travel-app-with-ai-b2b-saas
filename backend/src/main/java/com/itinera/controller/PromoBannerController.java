package com.itinera.controller;

import com.itinera.model.PromoBanner;
import com.itinera.service.PromoBannerService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

// Admin-managed promo/deal banner carousel - see PromoBanner. GET endpoints
// are public (SecurityConfig), everything else is admin-only, except
// GET /admin which is also admin-only (see SecurityConfig ordering note).
@RestController
@RequestMapping("/promo-banners")
public class PromoBannerController {

    private final PromoBannerService promoBannerService;

    public PromoBannerController(PromoBannerService promoBannerService) {
        this.promoBannerService = promoBannerService;
    }

    // Full list (all placements, active + inactive) for the admin management
    // screen.
    @GetMapping("/admin")
    public ResponseEntity<List<PromoBanner>> all() {
        return ResponseEntity.ok(promoBannerService.all());
    }

    // Active banners for one placement (e.g. "HOME", "HOTELS"), ordered for
    // display - what the customer-facing carousel actually fetches.
    @GetMapping("/{placement}")
    public ResponseEntity<List<PromoBanner>> byPlacement(@PathVariable String placement) {
        return ResponseEntity.ok(promoBannerService.activeForPlacement(placement));
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable Long id) {
        PromoBanner banner = promoBannerService.get(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(banner.getImageContentType()))
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .body(banner.getImageData());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PromoBanner> create(
            @RequestParam("image") MultipartFile image,
            @RequestParam String title,
            @RequestParam String placement,
            @RequestParam String linkType,
            @RequestParam(required = false) String linkTarget,
            @RequestParam(required = false) Integer displayOrder
    ) throws IOException {
        return ResponseEntity.ok(promoBannerService.create(image, title, placement, linkType, linkTarget, displayOrder));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PromoBanner> update(
            @PathVariable Long id,
            @RequestParam(required = false) MultipartFile image,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String placement,
            @RequestParam(required = false) String linkType,
            @RequestParam(required = false) String linkTarget,
            @RequestParam(required = false) Integer displayOrder,
            @RequestParam(required = false) Boolean active
    ) throws IOException {
        return ResponseEntity.ok(
                promoBannerService.update(id, image, title, placement, linkType, linkTarget, displayOrder, active)
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        promoBannerService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
