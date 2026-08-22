package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.ByteBuffer;
import java.sql.ResultSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaAssetUuidTypeHandlerTest {
  @Test
  void parsesBinaryPostgresUuidWithoutReflectiveConstruction() throws Exception {
    UUID expected = UUID.randomUUID();
    ByteBuffer buffer = ByteBuffer.allocate(16);
    buffer.putLong(expected.getMostSignificantBits());
    buffer.putLong(expected.getLeastSignificantBits());
    ResultSet resultSet = mock(ResultSet.class);
    when(resultSet.getObject("id")).thenReturn(buffer.array());

    UUID actual = new MediaAssetUuidTypeHandler().getNullableResult(resultSet, "id");

    assertThat(actual).isEqualTo(expected);
  }
}
