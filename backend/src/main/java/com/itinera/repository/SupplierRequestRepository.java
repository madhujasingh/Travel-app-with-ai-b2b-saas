package com.itinera.repository;

import com.itinera.model.SupplierRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SupplierRequestRepository extends JpaRepository<SupplierRequest, Long> {
    List<SupplierRequest> findBySupplierId(Long supplierId);
    List<SupplierRequest> findByStatus(SupplierRequest.RequestStatus status);
}
