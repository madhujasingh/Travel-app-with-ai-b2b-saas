package com.itinera.controller;

import com.itinera.model.Conversation;
import com.itinera.model.ConversationMessage;
import com.itinera.service.MessagingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/messages")
public class MessagingController {

    @Autowired
    private MessagingService messagingService;

    @GetMapping("/conversations/me")
    public ResponseEntity<List<Conversation>> getMyConversations() {
        return ResponseEntity.ok(messagingService.getMyConversations(getCurrentUserId()));
    }

    @GetMapping("/conversations/{conversationId}")
    public ResponseEntity<Conversation> getConversationById(@PathVariable Long conversationId) {
        return ResponseEntity.ok(messagingService.getConversationById(conversationId, getCurrentUserId()));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<ConversationMessage>> getMessages(@PathVariable Long conversationId) {
        return ResponseEntity.ok(messagingService.getMessages(conversationId, getCurrentUserId()));
    }

    @PostMapping("/conversations/customer/start")
    public ResponseEntity<Conversation> startCustomerConversation(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(messagingService.startCustomerToAgentConversation(getCurrentUserId(), payload));
    }

    @PostMapping("/conversations/supplier/start")
    public ResponseEntity<Conversation> startSupplierConversation(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(messagingService.startSupplierConversation(getCurrentUserId(), payload));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<ConversationMessage> sendMessage(
            @PathVariable Long conversationId,
            @RequestBody Map<String, String> payload
    ) {
        return ResponseEntity.ok(messagingService.addMessage(
                conversationId,
                getCurrentUserId(),
                payload.get("content")
        ));
    }

    @PostMapping("/conversations/{conversationId}/supplier-itinerary")
    public ResponseEntity<Map<String, Object>> submitSupplierItinerary(
            @PathVariable Long conversationId,
            @RequestBody Map<String, Object> payload
    ) {
        return ResponseEntity.ok(messagingService.submitSupplierItineraryTemplate(
                conversationId,
                getCurrentUserId(),
                payload
        ));
    }

    @GetMapping("/suppliers")
    public ResponseEntity<List<Map<String, Object>>> getSuppliersForAdmin() {
        List<Map<String, Object>> suppliers = messagingService.getSuppliersForAdmin(getCurrentUserId())
                .stream()
                .map(user -> Map.<String, Object>of(
                        "id", user.getId(),
                        "name", user.getName(),
                        "email", user.getEmail(),
                        "phone", user.getPhone(),
                        "role", user.getRole()
                ))
                .toList();
        return ResponseEntity.ok(suppliers);
    }

    private Long getCurrentUserId() {
        UsernamePasswordAuthenticationToken auth = (UsernamePasswordAuthenticationToken)
                SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
