package com.narrativex.backend.shared.api;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

public record PaginationResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean first,
    boolean last,
    boolean hasNext,
    boolean hasPrevious
) {

    public static <T> PaginationResponse<T> from(Page<T> page) {
        return new PaginationResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isFirst(),
            page.isLast(),
            page.hasNext(),
            page.hasPrevious());
    }

    public static <S, T> PaginationResponse<T> from(Page<S> page, Function<S, T> mapper) {
        return new PaginationResponse<>(
            page.getContent().stream().map(mapper).toList(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isFirst(),
            page.isLast(),
            page.hasNext(),
            page.hasPrevious());
    }
}
