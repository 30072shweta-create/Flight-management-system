package com.example.flight.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class BookingStatusConverter implements AttributeConverter<BookingStatus, String> {

    @Override
    public String convertToDatabaseColumn(BookingStatus attribute) {
        if (attribute == null) {
            return BookingStatus.PENDING.name();
        }
        return attribute.name();
    }

    @Override
    public BookingStatus convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return BookingStatus.PENDING;
        }
        return BookingStatus.fromString(dbData);
    }
}
