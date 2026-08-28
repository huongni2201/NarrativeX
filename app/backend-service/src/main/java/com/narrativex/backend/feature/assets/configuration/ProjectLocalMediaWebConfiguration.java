package com.narrativex.backend.feature.assets.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverters;
import org.springframework.http.converter.ResourceRegionHttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers MVC support required to stream byte ranges from project-local media files. */
@Configuration(proxyBeanMethods = false)
public class ProjectLocalMediaWebConfiguration implements WebMvcConfigurer {
  @Override
  public void configureMessageConverters(HttpMessageConverters.ServerBuilder builder) {
    builder.addCustomConverter(new ResourceRegionHttpMessageConverter());
  }
}
