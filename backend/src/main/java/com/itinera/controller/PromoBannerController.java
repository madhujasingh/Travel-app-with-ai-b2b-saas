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
import java.util.Map;

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
            @RequestParam(required = false) String description,
            @RequestParam String placement,
            @RequestParam String linkType,
            @RequestParam(required = false) String linkTarget,
            @RequestParam(required = false) Integer displayOrder
    ) throws IOException {
        return ResponseEntity.ok(
                promoBannerService.create(image, title, description, placement, linkType, linkTarget, displayOrder)
        );
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PromoBanner> update(
            @PathVariable Long id,
            @RequestParam(required = false) MultipartFile image,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String placement,
            @RequestParam(required = false) String linkType,
            @RequestParam(required = false) String linkTarget,
            @RequestParam(required = false) Integer displayOrder,
            @RequestParam(required = false) Boolean active
    ) throws IOException {
        return ResponseEntity.ok(
                promoBannerService.update(id, image, title, description, placement, linkType, linkTarget, displayOrder, active)
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        promoBannerService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // AI-suggested title + short description from an image the admin just
    // picked, before the banner is saved (see SecurityConfig - admin-only,
    // unlike the plain GETs above, since this costs a Gemini call).
    @PostMapping(value = "/suggest-title", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> suggestTitle(@RequestParam("image") MultipartFile image) throws IOException {
        return ResponseEntity.ok(promoBannerService.suggestForImage(image.getBytes(), image.getContentType()));
    }

    // Same, but for an already-saved banner's stored image (editing without
    // re-picking a new one).
    @GetMapping("/{id}/suggest-title")
    public ResponseEntity<Map<String, String>> suggestTitleForBanner(@PathVariable Long id) {
        return ResponseEntity.ok(promoBannerService.suggestForBanner(id));
    }
}
