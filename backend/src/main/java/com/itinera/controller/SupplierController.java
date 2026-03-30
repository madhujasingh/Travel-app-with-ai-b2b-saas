package com.itinera.controller;

import com.itinera.model.Supplier;
import com.itinera.service.SupplierService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/suppliers")
public class SupplierController {

    @Autowired
    private SupplierService supplierService;

    @GetMapping
    public ResponseEntity<List<Supplier>> getAllSuppliers() {
        return ResponseEntity.ok(supplierService.getAllSuppliers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Supplier> getSupplierById(@PathVariable Long id) {
        return supplierService.getSupplierById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<Supplier>> getSuppliersByType(@PathVariable String type) {
        return ResponseEntity.ok(
            supplierService.getSuppliersByType(Supplier.SupplierType.valueOf(type.toUpperCase()))
        );
    }

    @GetMapping("/verified")
    public ResponseEntity<List<Supplier>> getVerifiedSuppliers() {
        return ResponseEntity.ok(supplierService.getVerifiedSuppliers());
    }

    @PostMapping
    public ResponseEntity<Supplier> createSupplier(@RequestBody Supplier supplier) {
        return ResponseEntity.ok(supplierService.createSupplier(supplier));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Supplier> updateSupplier(
            @PathVariable Long id,
            @RequestBody Supplier supplier) {
        return ResponseEntity.ok(supplierService.updateSupplier(id, supplier));
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<Supplier> verifySupplier(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.verifySupplier(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSupplier(@PathVariable Long id) {
        supplierService.deleteSupplier(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/performance")
    public ResponseEntity<Map<String, Object>> getSupplierPerformance(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.getSupplierPerformanceMetrics(id));
    }

    @GetMapping("/performance/all")
    public ResponseEntity<List<Map<String, Object>>> getAllSuppliersPerformance() {
        return ResponseEntity.ok(supplierService.getAllSuppliersWithMetrics());
    }
}
