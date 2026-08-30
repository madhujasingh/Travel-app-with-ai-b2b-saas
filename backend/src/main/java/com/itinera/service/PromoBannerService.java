package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.PromoBanner;
import com.itinera.repository.PromoBannerRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PromoBannerService {

    // Kept short and generic on purpose - admins can still edit whatever
    // comes back before saving, this is a starting point, not the final copy.
    private static final String SUGGEST_TITLE_PROMPT =
            "Write a short, catchy marketing title (under 60 characters) for a travel deal/promo banner "
                    + "based on this image. Return ONLY the title text - no quotes, no explanation, no trailing punctuation.";

    private final PromoBannerRepository repository;
    private final GeminiClient geminiClient;

    public PromoBannerService(PromoBannerRepository repository, GeminiClient geminiClient) {
        this.repository = repository;
        this.geminiClient = geminiClient;
    }

    public String suggestTitle(byte[] imageBytes, String imageContentType) {
        return geminiClient.generateTextWithImage(SUGGEST_TITLE_PROMPT, imageBytes, imageContentType);
    }

    public String suggestTitleForBanner(Long id) {
        PromoBanner banner = get(id);
        return suggestTitle(banner.getImageData(), banner.getImageContentType());
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
            String placement,
            String linkType,
            String linkTarget,
            Integer displayOrder
    ) throws IOException {
        PromoBanner banner = new PromoBanner();
        banner.setImageData(image.getBytes());
        banner.setImageContentType(image.getContentType() != null ? image.getContentType() : "image/jpeg");
        banner.setTitle(title);
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
