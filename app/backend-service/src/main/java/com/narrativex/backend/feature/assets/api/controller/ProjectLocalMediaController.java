package com.narrativex.backend.feature.assets.api.controller;

import com.narrativex.backend.feature.assets.infrastructure.storage.ProjectLocalMediaAccess;
import com.narrativex.backend.feature.assets.infrastructure.storage.ProjectLocalMediaAccess.LocalMediaFile;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
  public ResponseEntity<Resource> download(@PathVariable String token) {
    LocalMediaFile file = projectLocalMediaAccess.resolve(token);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .contentType(file.contentType())
        .contentLength(file.sizeBytes())
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.inline().filename(file.filename()).build().toString())
        .header("X-Content-Type-Options", "nosniff")
        .body(file.resource());
  }
}
