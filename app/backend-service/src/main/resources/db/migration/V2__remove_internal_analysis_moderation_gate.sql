-- Chapter analysis no longer waits for an application-owned moderation review.
-- Keep the moderation column for compatibility with other moderation workflows; it is
-- informational for StoryVersion and is not an admission condition for Chapter Analyze.
ALTER TABLE story_versions
    DROP CONSTRAINT ck_story_versions_moderation_decision;

ALTER TABLE story_versions
    ADD CONSTRAINT ck_story_versions_moderation_decision
    CHECK (moderation_decision IN ('NOT_REQUIRED', 'PENDING', 'SAFE', 'REVIEW', 'BLOCK'));

UPDATE story_versions
   SET moderation_decision = 'NOT_REQUIRED',
       updated_at = CURRENT_TIMESTAMP,
       row_version = row_version + 1
 WHERE moderation_decision = 'PENDING';
