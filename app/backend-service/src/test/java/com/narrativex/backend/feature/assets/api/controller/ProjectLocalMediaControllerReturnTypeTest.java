package com.narrativex.backend.feature.assets.api.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;

class ProjectLocalMediaControllerReturnTypeTest {
  @Test
  void localMediaEndpointDeclaresResourceResponseSoMvcCanApplyRangeHandling() throws Exception {
    Method method = ProjectLocalMediaController.class.getDeclaredMethod("download", String.class);

    assertThat(method.getGenericReturnType()).isInstanceOf(ParameterizedType.class);
    ParameterizedType returnType = (ParameterizedType) method.getGenericReturnType();
    assertThat(returnType.getRawType()).isEqualTo(ResponseEntity.class);
    assertThat(returnType.getActualTypeArguments()).containsExactly(Resource.class);
  }
}
