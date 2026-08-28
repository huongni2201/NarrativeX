package com.narrativex.backend.feature.assets.api.controller;

import com.narrativex.backend.feature.assets.infrastructure.storage.ProjectLocalMediaAccess;
import com.narrativex.backend.feature.assets.infrastructure.storage.ProjectLocalMediaAccess.LocalMediaFile;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Streams short-lived capability URLs for project-local media to Desktop and media elements. */
@RestController
@RequestMapping("/api/v1/local-media")
public class ProjectLocalMediaController {
  private final ProjectLocalMediaAccess projectLocalMediaAccess;

  public ProjectLocalMediaController(ProjectLocalMediaAccess projectLocalMediaAccess) {
    this.projectLocalMediaAccess = projectLocalMediaAccess;
  }

  @GetMapping("/{token}")
  public ResponseEntity<?> download(
      @PathVariable String token,
      @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
    LocalMediaFile file = projectLocalMediaAccess.resolve(token);
    HttpHeaders headers = responseHeaders(file);

    if (rangeHeader == null || rangeHeader.isBlank()) {
      headers.setContentLength(file.sizeBytes());
      return new ResponseEntity<Resource>(file.resource(), headers, HttpStatus.OK);
    }

    List<HttpRange> ranges;
    try {
      ranges = HttpRange.parseRanges(rangeHeader);
    } catch (IllegalArgumentException ignored) {
      return rangeNotSatisfiable(headers, file.sizeBytes());
    }
    if (ranges.size() != 1) {
      return rangeNotSatisfiable(headers, file.sizeBytes());
    }

    try {
      HttpRange range = ranges.getFirst();
      long start = range.getRangeStart(file.sizeBytes());
      long end = range.getRangeEnd(file.sizeBytes());
      long count = end - start + 1;
      headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + file.sizeBytes());
      headers.setContentLength(count);
      return new ResponseEntity<ResourceRegion>(
          new ResourceRegion(file.resource(), start, count), headers, HttpStatus.PARTIAL_CONTENT);
    } catch (IllegalArgumentException ignored) {
      return rangeNotSatisfiable(headers, file.sizeBytes());
    }
  }

  private static HttpHeaders responseHeaders(LocalMediaFile file) {
    HttpHeaders headers = new HttpHeaders();
    headers.setCacheControl(CacheControl.noStore());
    headers.setContentType(file.contentType());
    headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
    headers.setContentDisposition(ContentDisposition.inline().filename(file.filename()).build());
    headers.set("X-Content-Type-Options", "nosniff");
    return headers;
  }

  private static ResponseEntity<Void> rangeNotSatisfiable(HttpHeaders headers, long sizeBytes) {
    headers.set(HttpHeaders.CONTENT_RANGE, "bytes */" + sizeBytes);
    headers.setContentLength(0);
    return new ResponseEntity<>(headers, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }
}
