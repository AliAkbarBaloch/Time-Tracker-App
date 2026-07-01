package com.timetracker.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.IOException;

/**
 * Serves the React SPA index.html for all non-API client-side routes so that
 * React Router can handle navigation after a hard refresh or direct link
 * (e.g. /dashboard, /tasks, /projects/5).
 *
 * Static file requests (paths containing a dot, e.g. app.js, favicon.ico) are
 * handled by Spring Boot's default ResourceHttpRequestHandler before this
 * controller is reached, so they never trigger this fallback.
 */
@Controller
public class SpaController {

    private static final String INDEX_HTML = "static/index.html";

    /**
     * Catches single-segment paths that are not API or H2-console routes and
     * have no file extension (e.g. /dashboard, /tasks, /login).
     */
    @GetMapping("/{path:^(?!api$|h2-console$)[^.]+}")
    @ResponseBody
    public ResponseEntity<Resource> spaRoot() throws IOException {
        return serveIndex();
    }

    /**
     * Catches deeper paths (e.g. /projects/5, /projects/5/details).
     */
    @GetMapping({"/{path:^(?!api|h2-console)[^.]+}/**"})
    @ResponseBody
    public ResponseEntity<Resource> spaDeep() throws IOException {
        return serveIndex();
    }

    private ResponseEntity<Resource> serveIndex() throws IOException {
        ClassPathResource resource = new ClassPathResource(INDEX_HTML);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(resource);
    }
}
