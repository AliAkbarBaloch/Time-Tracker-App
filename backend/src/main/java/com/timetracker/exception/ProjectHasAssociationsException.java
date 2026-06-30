package com.timetracker.exception;

public class ProjectHasAssociationsException extends RuntimeException {
    private final long taskCount;
    private final long subprojectCount;

    public ProjectHasAssociationsException(long taskCount, long subprojectCount) {
        super("Project has " + taskCount + " associated task(s) and " + subprojectCount
                + " subproject(s). Confirm deletion to disassociate tasks and remove subprojects.");
        this.taskCount = taskCount;
        this.subprojectCount = subprojectCount;
    }

    public long getTaskCount() { return taskCount; }
    public long getSubprojectCount() { return subprojectCount; }
}
