package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@MapperScan(basePackageClasses = ProviderOperationMapper.class)
public class ProviderOperationMyBatisConfiguration {}
