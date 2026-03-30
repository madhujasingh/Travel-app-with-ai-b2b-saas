package com.itinera.service;

import com.itinera.model.Supplier;
import com.itinera.model.SupplierRequest;
import com.itinera.repository.SupplierRepository;
import com.itinera.repository.SupplierRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class SupplierService {

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private SupplierRequestRepository supplierRequestRepository;

    public List<Supplier> getAllSuppliers() {
        return supplierRepository.findAll();
    }

    public Optional<Supplier> getSupplierById(Long id) {
        return supplierRepository.findById(id);
    }

    public List<Supplier> getSuppliersByType(Supplier.SupplierType type) {
        return supplierRepository.findByType(type);
    }

    public List<Supplier> getVerifiedSuppliers() {
        return supplierRepository.findByIsVerifiedTrue();
    }

    public Supplier createSupplier(Supplier supplier) {
        return supplierRepository.save(supplier);
    }

    public Supplier updateSupplier(Long id, Supplier supplier) {
        supplier.setId(id);
        return supplierRepository.save(supplier);
    }

    public Supplier verifySupplier(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        supplier.setIsVerified(true);
        return supplierRepository.save(supplier);
    }

    public void deleteSupplier(Long id) {
        supplierRepository.deleteById(id);
    }

    /**
     * Record supplier response and calculate response time
     */
    public SupplierRequest recordSupplierResponse(Long requestId, String quoteDetails, java.math.BigDecimal quotedPrice) {
        SupplierRequest request = supplierRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Supplier request not found"));
        
        LocalDateTime now = LocalDateTime.now();
        request.setRespondedAt(now);
        request.setQuoteDetails(quoteDetails);
        request.setQuotedPrice(quotedPrice);
        request.setStatus(SupplierRequest.RequestStatus.QUOTE_RECEIVED);
        
        // Calculate response time in minutes
        if (request.getCreatedAt() != null) {
            long minutes = ChronoUnit.MINUTES.between(request.getCreatedAt(), now);
            request.setResponseTimeMinutes(minutes);
        }
        
        SupplierRequest savedRequest = supplierRequestRepository.save(request);
        
        // Update supplier's average response time
        updateSupplierAverageResponseTime(request.getSupplier().getId());
        
        return savedRequest;
    }

    /**
     * Update supplier's average response time
     */
    private void updateSupplierAverageResponseTime(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        
        List<SupplierRequest> requests = supplierRequestRepository.findBySupplierId(supplierId);
        
        long totalResponseTime = 0;
        int respondedCount = 0;
        
        for (SupplierRequest req : requests) {
            if (req.getResponseTimeMinutes() != null && req.getResponseTimeMinutes() > 0) {
                totalResponseTime += req.getResponseTimeMinutes();
                respondedCount++;
            }
        }
        
        if (respondedCount > 0) {
            supplier.setAverageResponseTimeMinutes(totalResponseTime / respondedCount);
        }
        
        supplierRepository.save(supplier);
    }

    /**
     * Record conversion (when supplier request leads to booking)
     */
    public void recordConversion(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        
        supplier.setConvertedRequests(supplier.getConvertedRequests() + 1);
        updateConversionRate(supplier);
        supplierRepository.save(supplier);
    }

    /**
     * Update conversion rate for a supplier
     */
    private void updateConversionRate(Supplier supplier) {
        if (supplier.getTotalRequests() > 0) {
            double rate = (double) supplier.getConvertedRequests() / supplier.getTotalRequests() * 100;
            supplier.setConversionRate(rate);
        }
    }

    /**
     * Get supplier performance metrics
     */
    public Map<String, Object> getSupplierPerformanceMetrics(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("supplierId", supplier.getId());
        metrics.put("supplierName", supplier.getName());
        metrics.put("totalRequests", supplier.getTotalRequests());
        metrics.put("convertedRequests", supplier.getConvertedRequests());
        metrics.put("conversionRate", supplier.getConversionRate());
        metrics.put("averageResponseTimeMinutes", supplier.getAverageResponseTimeMinutes());
        
        return metrics;
    }

    /**
     * Get all suppliers with performance metrics
     */
    public List<Map<String, Object>> getAllSuppliersWithMetrics() {
        List<Supplier> suppliers = supplierRepository.findAll();
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        
        for (Supplier supplier : suppliers) {
            Map<String, Object> metrics = new HashMap<>();
            metrics.put("supplierId", supplier.getId());
            metrics.put("supplierName", supplier.getName());
            metrics.put("supplierType", supplier.getType());
            metrics.put("isVerified", supplier.getIsVerified());
            metrics.put("totalRequests", supplier.getTotalRequests());
            metrics.put("convertedRequests", supplier.getConvertedRequests());
            metrics.put("conversionRate", supplier.getConversionRate());
            metrics.put("averageResponseTimeMinutes", supplier.getAverageResponseTimeMinutes());
            result.add(metrics);
        }
        
        return result;
    }
}
