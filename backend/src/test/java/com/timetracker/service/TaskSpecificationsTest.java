package com.timetracker.service;

import com.timetracker.entity.Task;
import com.timetracker.entity.User;
import com.timetracker.specification.TaskSpecifications;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskSpecificationsTest {

    @Mock Root<Task> root;
    @Mock CriteriaQuery<?> query;
    @Mock CriteriaBuilder cb;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        // lenient: not every test calls root.get(), but those that do need a non-null Path
        Path<Object> pathStub = mock(Path.class);
        lenient().when(root.get(anyString())).thenReturn(pathStub);
    }

    // ── ownedBy ──────────────────────────────────────────────────────────────

    @Test
    void ownedBy_delegatesToCriteriaBuilderEqual() {
        User user = new User();
        Predicate expected = mock(Predicate.class);
        when(cb.equal(any(), eq(user))).thenReturn(expected);

        Predicate actual = TaskSpecifications.ownedBy(user).toPredicate(root, query, cb);

        assertThat(actual).isSameAs(expected);
        verify(cb).equal(root.get("user"), user);
    }

    // ── startedAtOrAfter ─────────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void startedAtOrAfter_delegatesToGreaterThanOrEqualTo() {
        Instant from = Instant.parse("2024-01-01T00:00:00Z");
        Predicate expected = mock(Predicate.class);
        when(cb.greaterThanOrEqualTo(any(Expression.class), eq(from))).thenReturn(expected);

        Predicate actual = TaskSpecifications.startedAtOrAfter(from).toPredicate(root, query, cb);

        assertThat(actual).isSameAs(expected);
        verify(cb).greaterThanOrEqualTo(root.get("startTime"), from);
    }

    // ── startedBefore ────────────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void startedBefore_delegatesToLessThanOrEqualTo() {
        Instant to = Instant.parse("2024-12-31T23:59:59Z");
        Predicate expected = mock(Predicate.class);
        when(cb.lessThanOrEqualTo(any(Expression.class), eq(to))).thenReturn(expected);

        Predicate actual = TaskSpecifications.startedBefore(to).toPredicate(root, query, cb);

        assertThat(actual).isSameAs(expected);
        verify(cb).lessThanOrEqualTo(root.get("startTime"), to);
    }

    // ── descriptionContains ──────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void descriptionContains_buildsLikePatternLowercase() {
        Expression<String> lowerExpr = mock(Expression.class);
        Predicate expected = mock(Predicate.class);
        when(cb.lower(any())).thenReturn(lowerExpr);
        when(cb.like(eq(lowerExpr), anyString())).thenReturn(expected);

        Predicate actual = TaskSpecifications.descriptionContains("Hello").toPredicate(root, query, cb);

        assertThat(actual).isSameAs(expected);
        // Pattern must be lowercased and wrapped in %
        verify(cb).like(lowerExpr, "%hello%");
    }

    @Test
    @SuppressWarnings("unchecked")
    void descriptionContains_searchAlreadyLowercase_patternUnchanged() {
        Expression<String> lowerExpr = mock(Expression.class);
        when(cb.lower(any())).thenReturn(lowerExpr);
        when(cb.like(eq(lowerExpr), anyString())).thenReturn(mock(Predicate.class));

        TaskSpecifications.descriptionContains("work").toPredicate(root, query, cb);

        verify(cb).like(lowerExpr, "%work%");
    }

    // ── inProjects — empty set ────────────────────────────────────────────────

    @Test
    void inProjects_emptySet_returnsDisjunction() {
        Predicate never = mock(Predicate.class);
        when(cb.disjunction()).thenReturn(never);

        Predicate actual = TaskSpecifications.inProjects(Set.of()).toPredicate(root, query, cb);

        assertThat(actual).isSameAs(never);
        verify(cb).disjunction();
    }

    // ── inProjects — non-empty set ────────────────────────────────────────────

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void inProjects_nonEmptySet_joinsProjectsAndAppliesInPredicate() {
        Join join = mock(Join.class);
        Path<Object> idPath = mock(Path.class);
        Predicate expected = mock(Predicate.class);
        when(root.join(eq("projects"), any())).thenReturn(join);
        when(join.get("id")).thenReturn(idPath);
        when(idPath.in(any(Set.class))).thenReturn(expected);

        Set<Long> ids = Set.of(1L, 2L);
        Specification<Task> spec = TaskSpecifications.inProjects(ids);
        Predicate actual = spec.toPredicate(root, query, cb);

        assertThat(actual).isSameAs(expected);
        verify(root).join("projects", jakarta.persistence.criteria.JoinType.INNER);
        verify(query).distinct(true);
        verify(idPath).in(ids);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void inProjects_singleId_stillJoinsAndMatchesCorrectly() {
        Join join = mock(Join.class);
        Path<Object> idPath = mock(Path.class);
        when(root.join(eq("projects"), any())).thenReturn(join);
        when(join.get("id")).thenReturn(idPath);
        when(idPath.in(any(Set.class))).thenReturn(mock(Predicate.class));

        TaskSpecifications.inProjects(Set.of(42L)).toPredicate(root, query, cb);

        verify(idPath).in(Set.of(42L));
    }
}
