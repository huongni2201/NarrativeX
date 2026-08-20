package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

/** Explicit PostgreSQL UUID mapping for MyBatis record constructor arguments. */
public class UuidTypeHandler extends BaseTypeHandler<UUID> {
  @Override
  public void setNonNullParameter(PreparedStatement ps, int i, UUID parameter, JdbcType jdbcType)
      throws SQLException {
    ps.setObject(i, parameter);
  }

  @Override
  public UUID getNullableResult(ResultSet rs, String columnName) throws SQLException {
    Object value = rs.getObject(columnName);
    return value == null ? null : UUID.fromString(value.toString());
  }

  @Override
  public UUID getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
    Object value = rs.getObject(columnIndex);
    return value == null ? null : UUID.fromString(value.toString());
  }

  @Override
  public UUID getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
    Object value = cs.getObject(columnIndex);
    return value == null ? null : UUID.fromString(value.toString());
  }
}
