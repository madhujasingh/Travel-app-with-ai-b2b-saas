package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.PromoBanner;
import com.itinera.repository.PromoBannerRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PromoBannerService {

    // Kept short and generic on purpose - admins can still edit whatever
    // comes back before saving, this is a starting point, not the final copy.
    // The exact "TITLE:"/"DESCRIPTION:" line format is parsed back out in
    // parseSuggestion() below - Gemini follows plain-text format instructions
    // reliably enough here that a second JSON-mode round trip isn't needed.
    private static final String SUGGEST_PROMPT =
            "Look at this travel deal/promo banner image. Respond in exactly this format, with no extra "
                    + "commentary before or after:\n"
                    + "TITLE: <a short, catchy marketing title, under 60 characters>\n"
                    + "DESCRIPTION: <a short, elegant, enticing one-line description, under 100 characters>";

    private final PromoBannerRepository repository;
    private final GeminiClient geminiClient;

    public PromoBannerService(PromoBannerRepository repository, GeminiClient geminiClient) {
        this.repository = repository;
        this.geminiClient = geminiClient;
    }

    public Map<String, String> suggestForImage(byte[] imageBytes, String imageContentType) {
        String raw = geminiClient.generateTextWithImage(SUGGEST_PROMPT, imageBytes, imageContentType);
        return parseSuggestion(raw);
    }

    public Map<String, String> suggestForBanner(Long id) {
        PromoBanner banner = get(id);
        return suggestForImage(banner.getImageData(), banner.getImageContentType());
    }

    private Map<String, String> parseSuggestion(String raw) {
        String title = null;
        String description = null;
        for (String line : raw.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.regionMatches(true, 0, "TITLE:", 0, 6)) {
                title = trimmed.substring(6).trim();
            } else if (trimmed.regionMatches(true, 0, "DESCRIPTION:", 0, 12)) {
                description = trimmed.substring(12).trim();
            }
        }
        Map<String, String> result = new HashMap<>();
        // Fall back to the raw text as the title if the model didn't follow
        // the requested format - still better than surfacing nothing.
        result.put("title", title != null ? title : raw.trim());
        result.put("description", description != null ? description : "");
        return result;
    }

    public List<PromoBanner> activeForPlacement(String placement) {
        return repository.findByPlacementAndActiveTrueOrderByDisplayOrderAsc(placement.toUpperCase());
    }

    public List<PromoBanner> all() {
        return repository.findAllByOrderByPlacementAscDisplayOrderAsc();
    }

    public PromoBanner get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promo banner", "id", id));
    }

    public PromoBanner create(
            MultipartFile image,
            String title,
            String description,
            String placement,
            String linkType,
            String linkTarget,
            Integer displayOrder
    ) throws IOException {
        PromoBanner banner = new PromoBanner();
        banner.setImageData(image.getBytes());
        banner.setImageContentType(image.getContentType() != null ? image.getContentType() : "image/jpeg");
        banner.setTitle(title);
        banner.setDescription(description);
        banner.setPlacement(placement.toUpperCase());
        banner.setLinkType(linkType.toUpperCase());
        banner.setLinkTarget(linkTarget);
        banner.setDisplayOrder(displayOrder != null ? displayOrder : 0);
        banner.setActive(true);
        banner.setCreatedAt(LocalDateTime.now());
        return repository.save(banner);
    }

    public PromoBanner update(
            Long id,
            MultipartFile image,
            String title,
            String description,
            String placement,
            String linkType,
            String linkTarget,
            Integer displayOrder,
            Boolean active
    ) throws IOException {
        PromoBanner banner = get(id);
        if (image != null && !image.isEmpty()) {
            banner.setImageData(image.getBytes());
            banner.setImageContentType(image.getContentType() != null ? image.getContentType() : "image/jpeg");
        }
        if (title != null) banner.setTitle(title);
        if (description != null) banner.setDescription(description);
        if (placement != null) banner.setPlacement(placement.toUpperCase());
        if (linkType != null) banner.setLinkType(linkType.toUpperCase());
        if (linkTarget != null) banner.setLinkTarget(linkTarget);
        if (displayOrder != null) banner.setDisplayOrder(displayOrder);
        if (active != null) banner.setActive(active);
        return repository.save(banner);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Promo banner", "id", id);
        }
        repository.deleteById(id);
    }
}
