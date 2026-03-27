package com.itinera.repository;

import com.itinera.model.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    List<Supplier> findByType(Supplier.SupplierType type);
    List<Supplier> findByIsVerifiedTrue();
    List<Supplier> findByIsActiveTrue();
    boolean existsByEmailAndIsVerifiedTrueAndIsActiveTrue(String email);
}
