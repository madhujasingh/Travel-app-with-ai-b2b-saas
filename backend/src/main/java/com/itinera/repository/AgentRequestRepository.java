package com.itinera.repository;

import com.itinera.model.AgentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AgentRequestRepository extends JpaRepository<AgentRequest, Long> {
    List<AgentRequest> findByStatus(AgentRequest.RequestStatus status);
    List<AgentRequest> findByAssignedAgentId(Long agentId);
}
