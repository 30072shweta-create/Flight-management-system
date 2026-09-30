package com.example.flight.entity;

public enum BookingStatus {

    REQUESTED,
    CANCELLED,
    REFUND_PENDING,
    REFUNDED,
    FAILED,
    CONFIRMED, 
    PENDING,

    // Lowercase aliases for legacy database compatibility
    requested,
    cancelled,
    refund_pending,
    refunded,
    failed,
    confirmed,
    pending;

    @com.fasterxml.jackson.annotation.JsonCreator
    public static BookingStatus fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            return PENDING;
        }
        String cleaned = value.trim();
        for (BookingStatus bs : values()) {
            if (bs.name().equalsIgnoreCase(cleaned) || bs.name().equalsIgnoreCase(cleaned.replace("-", "_").replace(" ", "_"))) {
                return bs;
            }
        }
        String normalized = cleaned.toUpperCase().replace("-", "_").replace(" ", "_");
        if (normalized.contains("CONFIRM")) {
            return CONFIRMED;
        } else if (normalized.contains("CANCEL")) {
            return CANCELLED;
        } else if (normalized.contains("REFUND")) {
            return REFUNDED;
        } else if (normalized.contains("FAIL")) {
            return FAILED;
        } else if (normalized.contains("REQ")) {
            return REQUESTED;
        }
        return PENDING;
    }
}