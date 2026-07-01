package com.timetracker.entity;

/**
 * Role of a user within a shared project.
 * OWNER: original creator; can invite/remove members, edit and delete the project.
 * MEMBER: invited collaborator; can create tasks and associate them with the project.
 */
public enum ProjectMemberRole {
    OWNER,
    MEMBER
}
