package com.itinera.controller;

import com.itinera.service.GroupTripService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/group-trips")
public class GroupTripController {
    private final GroupTripService groupTripService;

    public GroupTripController(GroupTripService groupTripService) {
        this.groupTripService = groupTripService;
    }

    @GetMapping
    public ResponseEntity<List<GroupTripService.GroupTripSummaryResponse>> getMyTrips(@RequestAttribute Long userId) {
        return ResponseEntity.ok(groupTripService.getMyTrips(userId));
    }

    @PostMapping
    public ResponseEntity<GroupTripService.GroupTripDetailResponse> createTrip(
            @RequestAttribute Long userId,
            @RequestBody GroupTripService.CreateGroupTripRequest request
    ) {
        return ResponseEntity.ok(groupTripService.createTrip(userId, request));
    }

    @PostMapping("/join")
    public ResponseEntity<GroupTripService.GroupTripDetailResponse> joinTrip(
            @RequestAttribute Long userId,
            @RequestBody GroupTripService.JoinGroupTripRequest request
    ) {
        return ResponseEntity.ok(groupTripService.joinTrip(userId, request));
    }

    @GetMapping("/{tripId}")
    public ResponseEntity<GroupTripService.GroupTripDetailResponse> getTrip(
            @PathVariable Long tripId,
            @RequestAttribute Long userId
    ) {
        return ResponseEntity.ok(groupTripService.getTrip(tripId, userId));
    }

    @PostMapping("/{tripId}/options")
    public ResponseEntity<GroupTripService.GroupTripOptionResponse> addOption(
            @PathVariable Long tripId,
            @RequestAttribute Long userId,
            @RequestBody GroupTripService.AddGroupTripOptionRequest request
    ) {
        return ResponseEntity.ok(groupTripService.addOption(tripId, userId, request));
    }

    @PostMapping("/{tripId}/options/{optionId}/vote")
    public ResponseEntity<GroupTripService.GroupTripOptionResponse> voteOnOption(
            @PathVariable Long tripId,
            @PathVariable Long optionId,
            @RequestAttribute Long userId,
            @RequestBody GroupTripService.VoteRequest request
    ) {
        return ResponseEntity.ok(groupTripService.voteOnOption(tripId, optionId, userId, request));
    }

    @PostMapping("/{tripId}/options/{optionId}/lock")
    public ResponseEntity<GroupTripService.GroupTripDetailResponse> lockWinner(
            @PathVariable Long tripId,
            @PathVariable Long optionId,
            @RequestAttribute Long userId
    ) {
        return ResponseEntity.ok(groupTripService.lockWinner(tripId, optionId, userId));
    }

    @PostMapping("/{tripId}/finalize")
    public ResponseEntity<GroupTripService.GroupTripDetailResponse> finalizeTrip(
            @PathVariable Long tripId,
            @RequestAttribute Long userId
    ) {
        return ResponseEntity.ok(groupTripService.finalizeTrip(tripId, userId));
    }
}
