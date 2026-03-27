package com.itinera.repository;

import com.itinera.model.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByCustomerIdOrderByUpdatedAtDesc(Long customerId);
    List<Conversation> findBySupplierIdOrderByUpdatedAtDesc(Long supplierId);
    List<Conversation> findByAdminIdOrderByUpdatedAtDesc(Long adminId);
}
