package com.narrativex.backend.feature.common.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.Objects;
import org.hibernate.proxy.HibernateProxy;

/** Common JPA audit mapping kept outside domain packages. */
@MappedSuperclass
public abstract class JpaAuditedEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id", nullable = false)
  private Long id;

  @Version
  @Column(name = "row_version", nullable = false)
  private long rowVersion;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public long getRowVersion() {
    return rowVersion;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  @Override
  public final boolean equals(Object other) {
    if (this == other) return true;
    if (other == null) return false;
    Class<?> thisClass = effectiveClass(this);
    Class<?> otherClass = effectiveClass(other);
    if (thisClass != otherClass) return false;
    JpaAuditedEntity that = (JpaAuditedEntity) other;
    return id != null && Objects.equals(id, that.id);
  }

  @Override
  public final int hashCode() {
    return effectiveClass(this).hashCode();
  }

  private static Class<?> effectiveClass(Object value) {
    return value instanceof HibernateProxy proxy
        ? proxy.getHibernateLazyInitializer().getPersistentClass()
        : value.getClass();
  }
}
