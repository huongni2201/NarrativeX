package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.nio.ByteBuffer;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;

@MappedTypes(UUID.class)
public class MediaAssetUuidTypeHandler extends BaseTypeHandler<UUID> {
  @Override
  public void setNonNullParameter(PreparedStatement ps, int i, UUID parameter, JdbcType jdbcType)
      throws SQLException {
    ps.setObject(i, parameter);
  }

  @Override
  public UUID getNullableResult(ResultSet rs, String columnName) throws SQLException {
    return parse(rs.getObject(columnName));
  }

  @Override
  public UUID getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
    return parse(rs.getObject(columnIndex));
  }

  @Override
  public UUID getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
    return parse(cs.getObject(columnIndex));
  }

  private static UUID parse(Object value) {
    if (value == null) return null;
    if (value instanceof UUID uuid) return uuid;
    if (value instanceof byte[] bytes) {
      if (bytes.length == 16) {
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        return new UUID(buffer.getLong(), buffer.getLong());
      }
      return UUID.fromString(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
    }
    return UUID.fromString(value.toString());
  }
}
