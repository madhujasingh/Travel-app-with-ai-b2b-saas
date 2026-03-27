package com.itinera.service;

import com.itinera.model.AgentRequest;
import com.itinera.repository.AgentRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class AgentRequestService {

    @Autowired
    private AgentRequestRepository agentRequestRepository;

    public List<AgentRequest> getAllRequests() {
        return agentRequestRepository.findAll();
    }

    public Optional<AgentRequest> getRequestById(Long id) {
        return agentRequestRepository.findById(id);
    }

    public List<AgentRequest> getRequestsByStatus(AgentRequest.RequestStatus status) {
        return agentRequestRepository.findByStatus(status);
    }

    public List<AgentRequest> getRequestsByAgentId(Long agentId) {
        return agentRequestRepository.findByAssignedAgentId(agentId);
    }

    public AgentRequest createRequest(AgentRequest request) {
        return agentRequestRepository.save(request);
    }

    public AgentRequest assignAgent(Long requestId, Long agentId) {
        AgentRequest request = agentRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        request.setAssignedAgentId(agentId);
        request.setStatus(AgentRequest.RequestStatus.ASSIGNED);
        return agentRequestRepository.save(request);
    }

    public AgentRequest updateStatus(Long requestId, AgentRequest.RequestStatus status) {
        AgentRequest request = agentRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        request.setStatus(status);
        return agentRequestRepository.save(request);
    }

    public void deleteRequest(Long id) {
        agentRequestRepository.deleteById(id);
    }
}
