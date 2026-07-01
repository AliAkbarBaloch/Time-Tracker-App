package com.timetracker.config;

import com.timetracker.entity.Project;
import com.timetracker.entity.ProjectMember;
import com.timetracker.entity.ProjectMemberRole;
import com.timetracker.repository.ProjectMemberRepository;
import com.timetracker.repository.ProjectRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs once on application startup to back-fill OWNER membership rows for every
 * project that was created before the project_members table was introduced.
 *
 * Without this seeder, existing projects would have no membership rows and the
 * member-based repository queries would return 0 results, making all pre-existing
 * projects invisible to their owners after the upgrade.
 */
@Component
public class MembershipSeeder implements ApplicationRunner {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;

    public MembershipSeeder(ProjectRepository projectRepository,
                            ProjectMemberRepository memberRepository) {
        this.projectRepository = projectRepository;
        this.memberRepository  = memberRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (Project project : projectRepository.findAll()) {
            // Only insert if no OWNER row exists yet (idempotent — safe to run repeatedly)
            if (!memberRepository.existsByProjectAndUser(project, project.getUser())) {
                ProjectMember ownerMembership = new ProjectMember();
                ownerMembership.setProject(project);
                ownerMembership.setUser(project.getUser());
                ownerMembership.setRole(ProjectMemberRole.OWNER);
                memberRepository.save(ownerMembership);
            }
        }
    }
}
