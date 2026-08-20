package com.narrativex.backend.feature.common.infrastructure.persistence.mybatis;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/** Shared MyBatis registration for explicitly opted-in feature mappers. */
@Configuration(proxyBeanMethods = false)
@MapperScan(
    basePackages = "com.narrativex.backend.feature",
    markerInterface = NarrativeXMyBatisMapper.class)
public class MyBatisPersistenceConfiguration {}
