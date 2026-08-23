package com.narrativex.backend.feature.render.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.render.api.response.FinalArtifactResponse;
import com.narrativex.backend.feature.render.application.usecase.GetFinalArtifactByJobUseCase;
import com.narrativex.backend.feature.render.application.usecase.GetFinalArtifactUseCase;
import com.narrativex.backend.feature.render.application.usecase.ReadFinalArtifactContentUseCase;
import java.io.IOException;
import java.io.InputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/artifacts")
public class FinalArtifactController {
  private final GetFinalArtifactUseCase getFinalArtifactUseCase;
  private final GetFinalArtifactByJobUseCase getFinalArtifactByJobUseCase;
  private final ReadFinalArtifactContentUseCase readFinalArtifactContentUseCase;

  @GetMapping("/{artifactId}")
  public ResponseEntity<ApiResponse<FinalArtifactResponse>> get(@PathVariable Long artifactId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Final artifact retrieved successfully",
            FinalArtifactResponse.from(getFinalArtifactUseCase.execute(artifactId))));
  }

  @GetMapping("/by-job/{jobId}")
  public ResponseEntity<ApiResponse<FinalArtifactResponse>> getByJob(@PathVariable String jobId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Final artifact retrieved successfully",
            FinalArtifactResponse.from(getFinalArtifactByJobUseCase.execute(jobId))));
  }

  @GetMapping("/{artifactId}/download")
  public ResponseEntity<StreamingResponseBody> download(
      @PathVariable Long artifactId,
      @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
    return stream(artifactId, range, true);
  }

  @GetMapping({"/{artifactId}/content", "/{artifactId}/preview"})
  public ResponseEntity<StreamingResponseBody> preview(
      @PathVariable Long artifactId,
      @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
    return stream(artifactId, range, false);
  }

  private ResponseEntity<StreamingResponseBody> stream(
      Long artifactId, String rangeHeader, boolean attachment) {
    var artifact = getFinalArtifactUseCase.execute(artifactId);
    ByteRange range = ByteRange.parse(rangeHeader, artifact.sizeBytes());
    if (range == null && rangeHeader != null && !rangeHeader.isBlank()) {
      HttpHeaders headers = new HttpHeaders();
      if (artifact.sizeBytes() != null) {
        headers.set(HttpHeaders.CONTENT_RANGE, "bytes */" + artifact.sizeBytes());
      }
      return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
          .headers(headers)
          .build();
    }

    var content =
        readFinalArtifactContentUseCase.execute(
            artifact, range == null ? null : range.start(), range == null ? null : range.end());
    var stream = content.content();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(safeMediaType(content.metadata().mimeType()));
    headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
    if (stream.contentLength() != null) {
      headers.setContentLength(stream.contentLength());
    }
    if (stream.contentRangeHeader() != null) {
      headers.set(HttpHeaders.CONTENT_RANGE, stream.contentRangeHeader());
    }
    headers.setContentDisposition(
        attachment
            ? org.springframework.http.ContentDisposition.attachment()
                .filename("artifact-" + artifactId + ".mp4")
                .build()
            : org.springframework.http.ContentDisposition.inline()
                .filename("artifact-" + artifactId + ".mp4")
                .build());
    StreamingResponseBody body = output -> copyAndClose(stream.content(), output);
    return ResponseEntity.status(stream.partial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK)
        .headers(headers)
        .body(body);
  }

  private static void copyAndClose(InputStream input, java.io.OutputStream output)
      throws IOException {
    try (input) {
      input.transferTo(output);
    }
  }

  private static MediaType safeMediaType(String mimeType) {
    try {
      return mimeType == null || mimeType.isBlank()
          ? MediaType.APPLICATION_OCTET_STREAM
          : MediaType.parseMediaType(mimeType);
    } catch (IllegalArgumentException ignored) {
      return MediaType.APPLICATION_OCTET_STREAM;
    }
  }

  private record ByteRange(long start, long end) {
    private static ByteRange parse(String header, Long totalLength) {
      if (header == null || header.isBlank()) return null;
      if (totalLength == null || totalLength < 1) return null;
      String value = header.trim();
      if (!value.regionMatches(true, 0, "bytes=", 0, 6) || value.indexOf(',') >= 0) return null;
      String range = value.substring(6).trim();
      int separator = range.indexOf('-');
      if (separator < 0) return null;
      String startValue = range.substring(0, separator).trim();
      String endValue = range.substring(separator + 1).trim();
      try {
        if (startValue.isEmpty()) {
          long suffixLength = Long.parseLong(endValue);
          if (suffixLength <= 0) return null;
          long start = Math.max(0, totalLength - suffixLength);
          return new ByteRange(start, totalLength - 1);
        }
        long start = Long.parseLong(startValue);
        if (start < 0 || start >= totalLength) return null;
        long end = endValue.isEmpty() ? totalLength - 1 : Long.parseLong(endValue);
        if (end < start) return null;
        return new ByteRange(start, Math.min(end, totalLength - 1));
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
  }
}
