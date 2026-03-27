package com.itinera.controller;

import com.itinera.model.AgentRequest;
import com.itinera.service.AgentRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/agent-requests")
public class AgentRequestController {

    @Autowired
    private AgentRequestService agentRequestService;

    @GetMapping
    public ResponseEntity<List<AgentRequest>> getAllRequests() {
        return ResponseEntity.ok(agentRequestService.getAllRequests());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgentRequest> getRequestById(@PathVariable Long id) {
        return agentRequestService.getRequestById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<AgentRequest>> getRequestsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(
            agentRequestService.getRequestsByStatus(AgentRequest.RequestStatus.valueOf(status.toUpperCase()))
        );
    }

    @GetMapping("/agent/{agentId}")
    public ResponseEntity<List<AgentRequest>> getRequestsByAgentId(@PathVariable Long agentId) {
        return ResponseEntity.ok(agentRequestService.getRequestsByAgentId(agentId));
    }

    @PostMapping
    public ResponseEntity<AgentRequest> createRequest(@RequestBody AgentRequest request) {
        return ResponseEntity.ok(agentRequestService.createRequest(request));
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<AgentRequest> assignAgent(
            @PathVariable Long id,
            @RequestParam Long agentId) {
        return ResponseEntity.ok(agentRequestService.assignAgent(id, agentId));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<AgentRequest> updateStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        return ResponseEntity.ok(
            agentRequestService.updateStatus(id, AgentRequest.RequestStatus.valueOf(status.toUpperCase()))
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRequest(@PathVariable Long id) {
        agentRequestService.deleteRequest(id);
        return ResponseEntity.ok().build();
    }
}
