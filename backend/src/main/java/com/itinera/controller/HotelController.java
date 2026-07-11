package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.HotelService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/hotels")
public class HotelController {

    private final HotelService hotelService;

    public HotelController(HotelService hotelService) {
        this.hotelService = hotelService;
    }

    @PostMapping("/listing")
    public ResponseEntity<JsonNode> listing(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.listing(payload));
    }

    @PostMapping("/detail")
    public ResponseEntity<JsonNode> detail(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.detail(payload));
    }

    @PostMapping("/review")
    public ResponseEntity<JsonNode> review(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.review(payload));
    }

    @PostMapping("/static-detail")
    public ResponseEntity<JsonNode> staticDetail(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.staticDetail(payload));
    }
}
