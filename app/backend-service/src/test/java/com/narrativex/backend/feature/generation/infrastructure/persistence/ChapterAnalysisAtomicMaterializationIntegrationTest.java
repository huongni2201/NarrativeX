package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisJobHandler;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

class ChapterAnalysisAtomicMaterializationIntegrationTest {
  @Configuration
  @EnableTransactionManagement
  static class Transactions {}

  @Test
  void rollsBackStoryWritesWhenMaterializationFailsAndLeavesTheJobUncompleted() throws Exception {
    String source = "Chapter text content";
    String sourceHash =
        HexFormat.of()
            .formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(StandardCharsets.UTF_8)));
    GenerationJob job =
        GenerationJob.createChapterAnalysis(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                0L,
                sourceHash,
                source,
                "en",
                "atomic-analysis-test")
            .markRunning("ANALYZING_STORY", 10);
    Map<UUID, GenerationJob> jobs = new HashMap<>();
    jobs.put(job.getJobId(), job);
    GenerationJobRepository repository = mock(GenerationJobRepository.class);
    when(repository.findByJobId(any()))
        .thenAnswer(i -> Optional.ofNullable(jobs.get(i.getArgument(0))));
    when(repository.save(any()))
        .thenAnswer(
            i -> {
              GenerationJob saved = i.getArgument(0);
              jobs.put(saved.getJobId(), saved);
              return saved;
            });

    DriverManagerDataSource dataSource =
        new DriverManagerDataSource(
            "jdbc:h2:mem:atomic-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
    JdbcTemplate jdbc = new JdbcTemplate(dataSource);
    jdbc.execute("CREATE TABLE materialized_scene(id VARCHAR(36), title VARCHAR(100))");
    StoryboardMapper storyboard = mock(StoryboardMapper.class);
    AtomicBoolean storyWriteAttempted = new AtomicBoolean();
    when(storyboard.insertScene(any()))
        .thenAnswer(
            i -> {
              SceneRow row = i.getArgument(0);
              UUID id = UUID.randomUUID();
              jdbc.update(
                  "INSERT INTO materialized_scene VALUES (?, ?)", id.toString(), row.getTitle());
              storyWriteAttempted.set(true);
              return id;
            });
    when(storyboard.insertStoryBeat(any()))
        .thenThrow(new IllegalStateException("second write failed"));
    ChapterMapper chapters = mock(ChapterMapper.class);
    ChapterRow chapter = new ChapterRow();
    chapter.setId(job.getChapterId());
    chapter.setSourceText(source);
    chapter.setSourceHash(sourceHash);
    chapter.setRowVersion(0L);
    when(chapters.findById(job.getChapterId())).thenReturn(chapter);
    ChapterAnalysisResult result =
        new ChapterAnalysisResult(
            """
          {"scenes":[{"title":"Scene","visual_beats":[{
            "title":"Beat","visual_intent":"A frame","start_unit":0,
            "visual_direction":{"shot_size":"WIDE","camera_angle":"EYE_LEVEL","lens_mm":35,
              "focus_target":"subject","action_phase":"BEFORE","subject_placement":"center",
              "background":"room","motivated_light":"soft","palette":"warm",
              "camera_movement":"NONE","movement_intensity":"SUBTLE","crop_safe_area":"full"}
          }]}]}
          """,
            ChapterAnalysisUsage.zero(),
            "fixture-model",
            null);
    ChapterAnalysisRequest request =
        ChapterAnalysisRequest.simple(job.getProjectId(), job.getChapterId(), source, "en");

    try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
      context.register(Transactions.class);
      context.registerBean(
          "transactionManager",
          PlatformTransactionManager.class,
          () -> new DataSourceTransactionManager(dataSource));
      context.registerBean(
          GenerationJobTransactionService.class,
          () -> new GenerationJobTransactionService(repository));
      context.registerBean(
          ChapterAnalysisJobHandler.class,
          () ->
              new ChapterAnalysisJobHandler(
                  repository,
                  context.getBean(GenerationJobTransactionService.class),
                  storyboard,
                  chapters,
                  null,
                  null,
                  null));
      context.refresh();
      ChapterAnalysisJobHandler handler = context.getBean(ChapterAnalysisJobHandler.class);
      ChapterAnalysisJobHandler.LocalProvenance provenance =
          new ChapterAnalysisJobHandler.LocalProvenance(
              UUID.randomUUID(),
              UUID.randomUUID(),
              "antigravity-cli/1",
              "conversation-1",
              ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI);

      assertThatThrownBy(() -> handler.materializeAndComplete(job, request, result, provenance))
          .isInstanceOf(RuntimeException.class)
          .hasStackTraceContaining("second write failed");

      assertThat(storyWriteAttempted).isTrue();
      assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM materialized_scene", Integer.class))
          .isZero();
      assertThat(jobs.get(job.getJobId()).getStatus()).isNotEqualTo(JobStatus.COMPLETED);
    } finally {
      jdbc.execute("SHUTDOWN");
    }
  }
}
