package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.AIRecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ai")
public class AIController {

    private final AIRecommendationService aiRecommendationService;

    public AIController(AIRecommendationService aiRecommendationService) {
        this.aiRecommendationService = aiRecommendationService;
    }

    @PostMapping("/recommendations")
    public ResponseEntity<JsonNode> getRecommendations(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(aiRecommendationService.getRecommendations(payload));
    }
}
