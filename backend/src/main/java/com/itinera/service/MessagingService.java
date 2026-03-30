package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.Conversation;
import com.itinera.model.ConversationMessage;
import com.itinera.model.Itinerary;
import com.itinera.model.User;
import com.itinera.repository.ConversationMessageRepository;
import com.itinera.repository.ConversationRepository;
import com.itinera.repository.ItineraryRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MessagingService {

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ConversationMessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItineraryRepository itineraryRepository;

    public Conversation startCustomerToAgentConversation(Long currentUserId, Map<String, Object> payload) {
        User customer = getUserById(currentUserId);
        requireRole(customer, User.UserRole.CUSTOMER);

        User admin = getDefaultAdmin();

        Conversation conversation = new Conversation();
        conversation.setType(Conversation.ConversationType.CUSTOMER_ADMIN);
        conversation.setCustomerId(customer.getId());
        conversation.setAdminId(admin.getId());
        conversation.setItineraryId(getLong(payload, "itineraryId"));
        conversation.setDestination(getString(payload, "destination"));
        conversation.setNumberOfPeople(getInteger(payload, "numberOfPeople"));
        conversation.setBudget(getString(payload, "budget"));
        conversation.setSummary(getString(payload, "summary"));
        Conversation saved = conversationRepository.save(conversation);

        String initialMessage = getString(payload, "initialMessage");
        if (initialMessage != null && !initialMessage.isBlank()) {
            addMessage(saved.getId(), currentUserId, initialMessage);
        }

        return saved;
    }

    public Conversation startSupplierConversation(Long currentUserId, Map<String, Object> payload) {
        User admin = getUserById(currentUserId);
        requireRole(admin, User.UserRole.ADMIN);

        Long supplierId = getLong(payload, "supplierId");
        if (supplierId == null) {
            throw new IllegalArgumentException("supplierId is required");
        }

        User supplier = getUserById(supplierId);
        requireRole(supplier, User.UserRole.SUPPLIER);

        Conversation conversation = new Conversation();
        conversation.setType(Conversation.ConversationType.SUPPLIER_ADMIN);
        conversation.setAdminId(admin.getId());
        conversation.setSupplierId(supplier.getId());
        conversation.setItineraryId(getLong(payload, "itineraryId"));
        conversation.setDestination(getString(payload, "destination"));
        conversation.setNumberOfPeople(getInteger(payload, "numberOfPeople"));
        conversation.setBudget(getString(payload, "budget"));
        conversation.setSummary(getString(payload, "summary"));
        Conversation saved = conversationRepository.save(conversation);

        String initialMessage = getString(payload, "initialMessage");
        if (initialMessage != null && !initialMessage.isBlank()) {
            addMessage(saved.getId(), currentUserId, initialMessage);
        }

        return saved;
    }

    public Conversation startSupplierToAdminConversation(Long currentUserId, Map<String, Object> payload) {
        User supplier = getUserById(currentUserId);
        requireRole(supplier, User.UserRole.SUPPLIER);

        User admin = getDefaultAdmin();

        Conversation conversation = new Conversation();
        conversation.setType(Conversation.ConversationType.SUPPLIER_ADMIN);
        conversation.setAdminId(admin.getId());
        conversation.setSupplierId(supplier.getId());
        conversation.setItineraryId(getLong(payload, "itineraryId"));
        conversation.setDestination(getString(payload, "destination"));
        conversation.setNumberOfPeople(getInteger(payload, "numberOfPeople"));
        conversation.setBudget(getString(payload, "budget"));
        conversation.setSummary(getString(payload, "summary"));
        Conversation saved = conversationRepository.save(conversation);

        String initialMessage = getString(payload, "initialMessage");
        if (initialMessage != null && !initialMessage.isBlank()) {
            addMessage(saved.getId(), currentUserId, initialMessage);
        }

        return saved;
    }

    public List<Conversation> getMyConversations(Long currentUserId) {
        User user = getUserById(currentUserId);

        if (user.getRole() == User.UserRole.ADMIN) {
            return conversationRepository.findByAdminIdOrderByUpdatedAtDesc(currentUserId);
        }
        if (user.getRole() == User.UserRole.CUSTOMER) {
            return conversationRepository.findByCustomerIdOrderByUpdatedAtDesc(currentUserId);
        }
        if (user.getRole() == User.UserRole.SUPPLIER) {
            return conversationRepository.findBySupplierIdOrderByUpdatedAtDesc(currentUserId);
        }

        throw new AccessDeniedException("Role is not allowed to use messaging");
    }

    public Conversation getConversationById(Long conversationId, Long currentUserId) {
        Conversation conversation = findConversation(conversationId);
        ensureUserIsParticipant(conversation, currentUserId);
        return conversation;
    }

    public List<ConversationMessage> getMessages(Long conversationId, Long currentUserId) {
        Conversation conversation = findConversation(conversationId);
        ensureUserIsParticipant(conversation, currentUserId);
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    public ConversationMessage addMessage(Long conversationId, Long currentUserId, String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Message content is required");
        }

        Conversation conversation = findConversation(conversationId);
        User sender = getUserById(currentUserId);

        ensureUserIsParticipant(conversation, currentUserId);
        ensureAllowedPairing(conversation, sender);

        ConversationMessage message = new ConversationMessage();
        message.setConversation(conversation);
        message.setSenderId(sender.getId());
        message.setSenderRole(sender.getRole());
        message.setContent(content.trim());
        ConversationMessage saved = messageRepository.save(message);

        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        return saved;
    }

    public List<User> getSuppliersForAdmin(Long currentUserId) {
        User currentUser = getUserById(currentUserId);
        requireRole(currentUser, User.UserRole.ADMIN);
        return userRepository.findByRole(User.UserRole.SUPPLIER);
    }

    public Map<String, Object> submitSupplierItineraryTemplate(Long conversationId, Long currentUserId, Map<String, Object> payload) {
        Conversation conversation = findConversation(conversationId);
        ensureUserIsParticipant(conversation, currentUserId);

        if (conversation.getType() != Conversation.ConversationType.SUPPLIER_ADMIN) {
            throw new AccessDeniedException("Template submission is allowed only in supplier-admin conversations");
        }

        User sender = getUserById(currentUserId);
        requireRole(sender, User.UserRole.SUPPLIER);

        String title = getString(payload, "title");
        String destination = getString(payload, "destination");
        String duration = getString(payload, "duration");
        String priceRaw = getString(payload, "price");

        if (isBlank(title) || isBlank(destination) || isBlank(duration) || isBlank(priceRaw)) {
            throw new IllegalArgumentException("title, destination, duration and price are required");
        }

        BigDecimal price;
        try {
            price = new BigDecimal(priceRaw.trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("price must be a valid number");
        }

        Itinerary itinerary = new Itinerary();
        itinerary.setTitle(title.trim());
        itinerary.setDestination(destination.trim());
        itinerary.setDuration(duration.trim());
        itinerary.setPrice(price);
        itinerary.setRating(4);
        itinerary.setReviewCount(0);
        itinerary.setDescription(getString(payload, "notes"));
        itinerary.setImageUrl(getString(payload, "imageUrl"));
        itinerary.setIsActive(true);

        String typeRaw = getString(payload, "type");
        if (!isBlank(typeRaw)) {
            itinerary.setType(Itinerary.ItineraryType.valueOf(typeRaw.trim().toUpperCase()));
        } else {
            itinerary.setType(Itinerary.ItineraryType.PREMIUM);
        }

        String categoryRaw = getString(payload, "category");
        if (!isBlank(categoryRaw)) {
            itinerary.setCategory(Itinerary.Category.valueOf(categoryRaw.trim().toUpperCase()));
        } else {
            itinerary.setCategory(Itinerary.Category.INDIA);
        }

        itinerary.setHighlights(getStringList(payload, "highlights"));
        itinerary.setInclusions(getStringList(payload, "inclusions"));
        itinerary.setExclusions(getStringList(payload, "exclusions"));

        Itinerary savedItinerary = itineraryRepository.save(itinerary);

        String templateMessage = buildTemplateMessage(savedItinerary, payload);
        ConversationMessage message = addMessage(conversationId, currentUserId, templateMessage);

        Map<String, Object> response = new HashMap<>();
        response.put("itineraryId", savedItinerary.getId());
        response.put("messageId", message.getId());
        response.put("title", savedItinerary.getTitle());
        response.put("destination", savedItinerary.getDestination());
        response.put("price", savedItinerary.getPrice());
        return response;
    }

    private String buildTemplateMessage(Itinerary itinerary, Map<String, Object> payload) {
        StringBuilder sb = new StringBuilder();
        sb.append("SUPPLIER ITINERARY PROPOSAL").append('\n');
        sb.append("Title: ").append(itinerary.getTitle()).append('\n');
        sb.append("Destination: ").append(itinerary.getDestination()).append('\n');
        sb.append("Duration: ").append(itinerary.getDuration()).append('\n');
        sb.append("Price: INR ").append(itinerary.getPrice()).append('\n');
        sb.append("Type: ").append(itinerary.getType()).append('\n');
        sb.append("Category: ").append(itinerary.getCategory()).append('\n');

        List<String> highlights = itinerary.getHighlights();
        if (highlights != null && !highlights.isEmpty()) {
            sb.append("Highlights: ").append(String.join(", ", highlights)).append('\n');
        }

        List<String> inclusions = itinerary.getInclusions();
        if (inclusions != null && !inclusions.isEmpty()) {
            sb.append("Inclusions: ").append(String.join(", ", inclusions)).append('\n');
        }

        List<String> exclusions = itinerary.getExclusions();
        if (exclusions != null && !exclusions.isEmpty()) {
            sb.append("Exclusions: ").append(String.join(", ", exclusions)).append('\n');
        }

        String notes = getString(payload, "notes");
        if (!isBlank(notes)) {
            sb.append("Supplier Notes: ").append(notes.trim()).append('\n');
        }

        sb.append("Linked Itinerary ID: ").append(itinerary.getId());
        return sb.toString();
    }

    private void ensureAllowedPairing(Conversation conversation, User sender) {
        if (conversation.getType() == Conversation.ConversationType.CUSTOMER_ADMIN) {
            boolean validSender = sender.getRole() == User.UserRole.CUSTOMER || sender.getRole() == User.UserRole.ADMIN;
            if (!validSender) {
                throw new AccessDeniedException("Only customer and travel agent can chat in this conversation");
            }
            return;
        }

        boolean validSender = sender.getRole() == User.UserRole.SUPPLIER || sender.getRole() == User.UserRole.ADMIN;
        if (!validSender) {
            throw new AccessDeniedException("Only supplier and admin can chat in this conversation");
        }
    }

    private void ensureUserIsParticipant(Conversation conversation, Long userId) {
        boolean isParticipant = userId.equals(conversation.getAdminId())
                || userId.equals(conversation.getCustomerId())
                || userId.equals(conversation.getSupplierId());

        if (!isParticipant) {
            throw new AccessDeniedException("You are not a participant in this conversation");
        }
    }

    private Conversation findConversation(Long conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", "id", conversationId));
    }

    private User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }

    private User getDefaultAdmin() {
        List<User> admins = userRepository.findByRole(User.UserRole.ADMIN);
        if (admins.isEmpty()) {
            throw new ResourceNotFoundException("No admin account exists to receive the request");
        }
        return admins.get(0);
    }

    private void requireRole(User user, User.UserRole role) {
        if (user.getRole() != role) {
            throw new AccessDeniedException("Only " + role + " can perform this action");
        }
    }

    private String getString(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            return null;
        }
        return String.valueOf(value);
    }

    private List<String> getStringList(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> rawList) {
            List<String> cleaned = new ArrayList<>();
            for (Object raw : rawList) {
                if (raw == null) {
                    continue;
                }
                String item = String.valueOf(raw).trim();
                if (!item.isBlank()) {
                    cleaned.add(item);
                }
            }
            return cleaned;
        }

        String asText = String.valueOf(value);
        if (asText.isBlank()) {
            return List.of();
        }

        String[] split = asText.split("[,\\n]");
        List<String> cleaned = new ArrayList<>();
        for (String part : split) {
            String item = part.trim();
            if (!item.isBlank()) {
                cleaned.add(item);
            }
        }
        return cleaned;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }

    private Long getLong(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private Integer getInteger(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }
}
