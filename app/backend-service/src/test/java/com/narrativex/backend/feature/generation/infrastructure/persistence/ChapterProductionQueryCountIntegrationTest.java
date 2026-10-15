package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.usecase.GetChapterProductionUseCase;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Signature;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Import(ChapterProductionQueryCountIntegrationTest.CountingConfiguration.class)
class ChapterProductionQueryCountIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired JdbcTemplate jdbc;
  @Autowired GetChapterProductionUseCase production;
  @Autowired QueryCounter queries;

  @Test
  void takesAndSelectionReadCountStaysConstantForOneTenAndHundredShots() {
    for (int count : List.of(1, 10, 100)) {
      UUID project =
          id(
              "INSERT INTO projects(name,status,source_language,narration_language,metadata_language,image_aspect_ratio) VALUES ('query-count','DRAFT','en','en','en','RATIO_16_9') RETURNING id");
      UUID story =
          id(
              "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,'Fixture','en','ACTIVE') RETURNING id",
              project);
      UUID chapter =
          id(
              "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash) VALUES (?,1,'Fixture','Fixture',?) RETURNING id",
              story,
              "a".repeat(64));
      UUID revision =
          id(
              "INSERT INTO storyboard_revisions(chapter_id,revision_number,source_hash,source_row_version) VALUES (?,1,?,0) RETURNING id",
              chapter,
              "a".repeat(64));
      jdbc.update(
          "UPDATE chapters SET current_storyboard_revision_id=? WHERE id=?", revision, chapter);
      UUID scene =
          id(
              "INSERT INTO scenes(storyboard_revision_id,chapter_id,project_id,order_index,title) VALUES (?,?,?,1,'Fixture') RETURNING id",
              revision,
              chapter,
              project);
      UUID beat =
          id(
              "INSERT INTO visual_beats(scene_id,order_index,title,visual_intent,review_status) VALUES (?,1,'Fixture','Fixture','APPROVED') RETURNING id",
              scene);
      UUID sequence =
          id("INSERT INTO shot_sequences(visual_beat_id) VALUES (?) RETURNING id", beat);
      for (int index = 0; index < count; index++) {
        UUID shot =
            id(
                "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,?,'Fixture') RETURNING id",
                sequence,
                index);
        UUID take =
            id(
                "INSERT INTO takes(shot_id,attempt_number,source_duration_ms,validation_status,status) VALUES (?,1,1000,'PASSED','PASSED') RETURNING id",
                shot);
        jdbc.update(
            "INSERT INTO selected_takes(shot_id,take_id,source_in_ms,source_out_ms) VALUES (?,?,0,1000)",
            shot,
            take);
      }

      queries.start();
      var result = production.execute(project, chapter);
      Map<String, Integer> counts = queries.finish();
      assertThat(counts)
          .containsEntry("TakeMapper.findByShotIds", 1)
          .containsEntry("SelectedTakeMapper.findByShotIds", 1)
          .hasSize(2);
      assertThat(result.totalShots()).isEqualTo(count);
      assertThat(result.selectedShots()).isEqualTo(count);
      var shots = result.scenes().getFirst().visualBeats().getFirst().shotSequence().shots();
      assertThat(shots)
          .hasSize(count)
          .allSatisfy(
              shot -> {
                assertThat(shot.takes()).hasSize(1);
                assertThat(shot.selectedTake().takeId()).isEqualTo(shot.takes().getFirst().id());
              });
    }
  }

  private UUID id(String sql, Object... arguments) {
    return jdbc.queryForObject(sql, UUID.class, arguments);
  }

  @TestConfiguration(proxyBeanMethods = false)
  static class CountingConfiguration {
    @Bean
    QueryCounter queryCounter() {
      return new QueryCounter();
    }
  }

  @Intercepts(
      @Signature(
          type = Executor.class,
          method = "query",
          args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}))
  static class QueryCounter implements Interceptor {
    private final ThreadLocal<Map<String, Integer>> counts = new ThreadLocal<>();

    void start() {
      counts.set(new HashMap<>());
    }

    Map<String, Integer> finish() {
      var result = Map.copyOf(counts.get());
      counts.remove();
      return result;
    }

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
      var current = counts.get();
      String id = ((MappedStatement) invocation.getArgs()[0]).getId();
      if (current != null && (id.contains(".TakeMapper.") || id.contains(".SelectedTakeMapper."))) {
        String key = id.substring(id.lastIndexOf(".mybatis.") + ".mybatis.".length());
        current.merge(key, 1, Integer::sum);
      }
      return invocation.proceed();
    }
  }
}
