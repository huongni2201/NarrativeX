package com.narrativex.backend.feature.assets.api.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter;

@SpringBootTest
@ActiveProfiles("test")
class ProjectLocalMediaMessageConverterIntegrationTest {
  @Autowired RequestMappingHandlerAdapter handlerAdapter;

  @Test
  void mvcCanWriteAudioResourceRegions() {
    assertThat(handlerAdapter.getMessageConverters())
        .anyMatch(converter -> converter.canWrite(ResourceRegion.class, MediaType.parseMediaType("audio/mpeg")));
  }
}
